const kafka = require("kafka-node");
const APM = require('elastic-apm-node');
const { Producer, KafkaClient, Consumer } = kafka;
const { sendToKafka, fakeSpan } = require("./helpers");

module.exports = ({ subscriptions, service }) => {

  const apm = APM.start({
    serverUrl: 'http://localhost:8200',
    serviceName: `${service} microservice`
  });

  const incomingMessageHandler = async (message, producer, topics, delay, name, targetTopic, spans) => {

    let transaction;
    let email;
    let traceParent;
    
    try {
      let { value } = message;
      value = JSON.parse(value);
      traceParent = value.traceParent;
      email = value.email;
      transaction = apm.startTransaction(name, service, { childOf: traceParent });
      process.send({ cmd: 'log', args: [value, topics[0].topic] });
      transaction.result = 'success';
    } catch (err) {
      process.send({ cmd: 'log', args: [`Error - Kafka message handler`, err.message] });
      transaction = apm.startTransaction(name, service);
      transaction.result = 'error';
    }

    spans.map((span) => fakeSpan(apm, span, process));

    setTimeout(async () => {
      transaction.end();
      if (targetTopic) {
        await sendToKafka(apm, producer, targetTopic, { email }, traceParent);
      }
    }, delay + (delay * Math.random() * 0.1));
  }

  subscriptions.forEach(({ topics, delay, name, targetTopic, spans = [] }) => {

    const client = new KafkaClient({ kafkaHost: 'localhost:9092' });

    const consumer = new Consumer(
      client,
      topics,
      {
        autoCommit: true
      }
    );

    let producer;

    if (targetTopic) {
      producer = new Producer(client);
      producer.on('ready', () => {
        process.send({ cmd: 'log', args: [`Kafka producer ready.`] });
      });
      producer.on('error', (err) => {
        process.send({ cmd: 'log', args: [`Kafka producer error.`, err.message] });
      });
    }

    process.send({ cmd: 'log', args: [`Worker ready.`, topics[0].topic] });

    consumer.on('message', (message) => incomingMessageHandler(message, producer, topics, delay, name, targetTopic, spans));

    consumer.on('error', (err) => {
      process.send({ cmd: 'log', args: [`Consumer error.`, err.message] });
    });

  });

}