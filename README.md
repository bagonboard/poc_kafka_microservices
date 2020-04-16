# Proof of concept

## Microservices 

Proof of concept, node.js microservices using kafka topics and [reactive programming](https://en.wikipedia.org/wiki/Reactive_programming), distributed tracing using Elastic Search [APM](https://www.elastic.co/es/apm).

* Express server.
  * Email sending service.
  * Invoice generation service.
  * Push notifications service.

## Kafka Containers

 * [Kafka](https://kafka.apache.org/)
 * [Zookeeper](https://zookeeper.apache.org/)
 * [Kafka manager](https://github.com/yahoo/CMAK)

## Usage

1. Launch Kafka containers
 ```shell
 docker-compose up
 ```
2. Launch ELK containers
```shell
docker-compose -f docker-compose.elk.yml up
```

3. Start express
```shell
npm run server
```
 
4. Selectively launch services
```shell
npm run microservice
```

## Exposed apps

 * [Kafka manager](http://localhost:9091)
 * [Kibana](http://localhost:5601)