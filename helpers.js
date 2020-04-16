
/**
 * Used to send fake spans to APM
 * @param {apm} apm 
 * @param {object<span>} param1 
 */
const fakeSpan = async (apm, { duration, name, type, subtype, action, spans = [] }, process) => {
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
 * @param {apm} apm 
 * @param {producer} producer 
 * @param {string} topic 
 * @param {object} messages 
 */
const sendToKafka = (apm, producer, topic, messages, currentTraceparent) =>
  new Promise((resolve, reject) => {
    const traceParent = currentTraceparent || apm.currentTraceparent;
    producer.send([{
      topic,
      messages: JSON.stringify({ ...messages, traceParent })
    }], (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  })

module.exports = {
  sendToKafka,
  fakeSpan
}