const kafka = require("kafka-node");
const { Producer, HighLevelProducer, KafkaClient } = kafka;

const config = {
  kafkaHost: 'localhost:9092'
}

module.exports = (apm, process) => {

  const { kafkaHost } = config;

  const clientFactory = (config = {}) =>
    new KafkaClient({ ...config, kafkaHost });

  const producerFactory = (type = 'Producer') => {
    try {
      const client = clientFactory();
      const producer = new kafka[type](client);
      producer.on('ready', () => {
        process.send({ cmd: 'log', args: [`Kafka ${type} ready.`] });
      });
      producer.on('error', (err) => {
        process.send({ cmd: 'log', args: [`Kafka ${type} error.`, err.message] });
      });
      return producer;
    } catch (error) {
      process.send({ cmd: 'log', args: [`producerFactory error.`, err.message] });
      throw error;
    }

  }

  const consumerFactory = (topics, config, groupId, type = 'Consumer') => {
    try {
      let consumer;
      if (type === 'Consumer') {
        const client = clientFactory();
        consumer = new kafka.Consumer(client, topics, config);
      } if (type === 'ConsumerGroup') {
        consumer = new kafka.ConsumerGroup({ kafkaHost, groupId, ...config }, topicNameExtractor(topics));
      }
      consumer.on('error', (error) => {
        process.send({ cmd: 'log', args: [`Consumer error.`, error.message] });
      });
      process.send({ cmd: 'log', args: [`${type} setup ready, topic:`, topicNameExtractor(topics), { kafkaHost, groupId, ...config }] });
      return consumer;
    } catch (error) {
      process.send({ cmd: 'log', args: [`consumerFactory error.`, error.message, { topics, config, groupId, type }] });
      throw error;
    }
  }

  /**
   * Used to send fake spans to APM
   * @param {object<span>} param1 
   */
  const fakeSpan = async ({ duration, name, type, subtype, action, spans = [] }) => {
    const span = apm.startSpan(name, type, subtype, action);
    setTimeout(() => {
      if (span) {
        span.end();
      } else {
        process.send({ cmd: 'log', args: ['error, span not created', { duration, name, type, subtype, action, spans }] });
      }
      spans.map((span) => fakeSpan(apm, span, process));
    }, duration);
  };

  /**
 * Used to inject the APM traceparent into the message payload
 * @param {producer} producer 
 * @param {string} topic 
 * @param {object} messages 
 * @param {traceparent} currentTraceparent
 */
  const sendToKafka = (producer, topic, messages, currentTraceparent) =>
    new Promise((resolve, reject) => {
      const traceParent = currentTraceparent || apm.currentTraceparent;
      producer.send([{
        topic,
        messages: JSON.stringify({ ...messages, traceParent })
      }], (err, data) => {
        const [partition, id] = Object.entries(data[topic]).pop();
        process.send({ cmd: 'log', args: ['New record sent to Kafka:', { topic, partition, id }] });
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    })

  return {
    sendToKafka,
    fakeSpan,
    producerFactory,
    consumerFactory
  }

};

// kafka-node library uses a very different Consumer vs ConsumerGroup signatures
// we need this helper to convert topics between consumer types
const topicNameExtractor = (consumerTopics) =>
  [... new Set(consumerTopics.reduce((all, { topic }) => [
    ...all,
    topic
  ], []))];
