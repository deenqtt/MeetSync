// Slim MQTT env-bus for the standalone internal app.
//
// The NexaBrick core version is a full request/response env bus (publishEnv,
// subscribeEnv, requestResponse, retained-config cache, ...). This app only
// ever needs fire-and-forget publishes on two topics:
//   - meetily/recording/command   (start/stop recording on the RPi)
//   - meetily/scheduler/probe      (connection pre-warm / health ping)
//
// So we keep a single lazily-connected mqtt client and expose publishEnv()
// with the same signature the meeting scheduler calls.

import mqtt, { type MqttClient, type IClientPublishOptions } from "mqtt";
import { loggers } from "@/lib/logger";

const BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";

declare global {
  // eslint-disable-next-line no-var
  var __mqttEnvBusClient: MqttClient | undefined;
  // eslint-disable-next-line no-var
  var __mqttEnvBusConnecting: Promise<MqttClient> | undefined;
}

function buildOptions() {
  const options: Record<string, unknown> = {
    reconnectPeriod: 5000,
    connectTimeout: 10_000,
    clientId: `nexabrick-internal-${process.pid}-${Math.floor(
      // eslint-disable-next-line no-restricted-properties
      Math.random() * 1e6,
    )}`,
  };
  if (process.env.MQTT_USERNAME) options.username = process.env.MQTT_USERNAME;
  if (process.env.MQTT_PASSWORD) options.password = process.env.MQTT_PASSWORD;
  return options;
}

/** Lazily connect (and reuse) a single MQTT client across the process. */
function getClient(): Promise<MqttClient> {
  if (globalThis.__mqttEnvBusClient?.connected) {
    return Promise.resolve(globalThis.__mqttEnvBusClient);
  }
  if (globalThis.__mqttEnvBusConnecting) {
    return globalThis.__mqttEnvBusConnecting;
  }

  globalThis.__mqttEnvBusConnecting = new Promise<MqttClient>((resolve, reject) => {
    const client = mqtt.connect(BROKER_URL, buildOptions());

    const onConnect = () => {
      loggers.mqtt.info(`env-bus connected to ${BROKER_URL}`);
      globalThis.__mqttEnvBusClient = client;
      globalThis.__mqttEnvBusConnecting = undefined;
      resolve(client);
    };
    const onError = (err: Error) => {
      loggers.mqtt.warn(`env-bus connect error: ${err.message}`);
      globalThis.__mqttEnvBusConnecting = undefined;
      // Let mqtt's own reconnect loop keep trying; reject this attempt.
      reject(err);
    };

    client.once("connect", onConnect);
    client.once("error", onError);
  });

  return globalThis.__mqttEnvBusConnecting;
}

export interface PublishEnvOptions {
  qos?: 0 | 1 | 2;
  retain?: boolean;
}

/**
 * Publish a JSON payload to an MQTT topic. Fire-and-forget; resolves once the
 * broker has accepted the message (or the publish callback fires).
 */
export async function publishEnv(
  topic: string,
  payload: unknown,
  opts: PublishEnvOptions = {},
): Promise<void> {
  const client = await getClient();
  const message = typeof payload === "string" ? payload : JSON.stringify(payload);
  const publishOpts: IClientPublishOptions = {
    qos: opts.qos ?? 0,
    retain: opts.retain ?? false,
  };

  await new Promise<void>((resolve, reject) => {
    client.publish(topic, message, publishOpts, (err) => {
      if (err) {
        loggers.mqtt.warn(`publishEnv failed on ${topic}: ${err.message}`);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/** Pre-warm the connection at boot (optional; publishEnv connects lazily too). */
export async function warmMqtt(): Promise<void> {
  try {
    await getClient();
  } catch {
    /* reconnect loop will keep retrying */
  }
}
