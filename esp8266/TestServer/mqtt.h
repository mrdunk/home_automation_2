#ifndef ESP8266__MQTT_H
#define ESP8266__MQTT_H

#include <ESP8266WiFi.h>
#include <PubSubClient.h>      // Include "PubSubClient" library.

#include "ipv4_helpers.h"
#include "Brokers.h"
#include "config.h"

struct Address_Segment {
  char segment[NAME_LEN];
};

class Mqtt{
 public:
  Mqtt(WiFiClient& wifi_client, Brokers* brokers_);

  void parse_topic(const char* topic, Address_Segment* address_segments);
  bool compare_addresses(const Address_Segment* address_1, const Address_Segment* address_2);
  String value_from_payload(const byte* payload, const unsigned int length, const String key);
  
  // Called whenever a MQTT topic we are subscribed to arrives.
  void callback(const char* topic, const byte* payload, const unsigned int length);

  // Publish a topic with hostname, ip, MAC address, etc.
  void mqtt_announce_host();

  // Publish a payload to a topic.
  void announce(const String topic, const String payload);

  // Assemble a list of topics we want to subscribe to.
  void queue_mqtt_subscription(const char* path);

  // Subscribe to one topic from the list we want.
  void subscribeOne();

  void mqtt_clear_buffers();

  // Called whenever we want to make sure we are subscribed to necessary topics.
  void connect();

  bool connected(){ return mqtt_client.connected(); }
  void forceDisconnect(){ mqtt_client.disconnect(); }
  void loop(){ mqtt_client.loop(); }
  void registerCallback(void (*registered_callback_)(const char* topic,
                                                     const byte* payload,
                                                     const unsigned int length)){ 
    registered_callback = registered_callback_;
  }

 private:
  PubSubClient mqtt_client;
  char mqtt_subscriptions[MAX_TOPIC_LENGTH * MAX_SUBSCRIPTIONS];
  int mqtt_subscription_count;
  int mqtt_subscribed_count;
  Brokers* brokers;
  void (*registered_callback)(const char* topic, const byte* payload, const unsigned int length);
};



#endif  // ESP8266__MQTT_H
