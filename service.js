const kafka = require("kafka-node");
const APM = require('elastic-apm-node');
const { KafkaClient } = kafka;

module.exports = ({ subscriptions, service, producer: producerType, consumer: consumerType }) => {

  const apm = APM.start({
    serverUrl: 'http://localhost:8200',
    serviceName: `${service} microservice`,
    //logLevel: 'trace'
  });

  const { sendToKafka, fakeSpan, producerFactory, consumerFactory } = require("./helpers")(apm, process);

  const incomingMessageHandler = async (message, producer, { topics, delay, name, producerTopic, spans, consumer: consumerConfig }, consumer) => {

    let transaction;
    let email;
    let traceParent;

    try {
      let { value } = message;
      value = JSON.parse(value);
      traceParent = value.traceParent;
      email = value.email;
      transaction = apm.startTransaction(name, service, { childOf: traceParent });
      process.send({ cmd: 'log', args: [message, topics[0].topic] });
      transaction.result = 'success';
    } catch (err) {
      process.send({ cmd: 'log', args: [`Error - Kafka message handler`, err.message] });
      transaction = apm.startTransaction(name, service);
      transaction.result = 'error';
    }

    spans.map((span) => fakeSpan(apm, span, process));

    setTimeout(async () => {
      transaction.end();
      if (producerTopic) {
        await sendToKafka(producer, producerTopic, { email }, traceParent);
      }
      if(consumerConfig.timeRequired) {
        setTimeout(()=>{
          consumer.commit((err, data) => {
            process.send({ cmd: 'log', args: [`Commit`] });
          })
        }, consumerConfig.timeRequired)
      }
    }, delay + (delay * Math.random() * 0.1));
  }

  subscriptions.forEach((subscription) => {

    const { topics, producerTopic, consumer: consumerConfig } = subscription;
    const consumer = consumerFactory(topics, consumerConfig.config, service, consumerType);
    const producer = producerTopic && producerFactory(producerType);

    consumer.on('message', (message) => incomingMessageHandler(message, producer, subscription, consumer));

  });

}