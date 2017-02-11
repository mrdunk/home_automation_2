/* Copyright <YEAR> <COPYRIGHT HOLDER>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

#ifndef ESP8266__MQTT_H
#define ESP8266__MQTT_H

#include <ESP8266WiFi.h>
#include <PubSubClient.h>      // Include "PubSubClient" library.


#include "config.h"
#include "mdns_actions.h"

struct Address_Segment {
  char segment[NAME_LEN];
};

class Mqtt{
 public:
  Mqtt(WiFiClient& wifi_client, MdnsLookup* brokers_) : 
      mqtt_client(PubSubClient(wifi_client)),
      brokers(brokers_),
      mqtt_subscription_count(0),
      mqtt_subscribed_count(0),
      was_connected(false),
      count_loop(0) {};

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
  void loop();
  void registerCallback(void (*registered_callback_)(const char* topic,
                                                     const byte* payload,
                                                     const unsigned int length)){ 
    registered_callback = registered_callback_;
  }

 private:
  PubSubClient mqtt_client;
  MdnsLookup* brokers;
  char mqtt_subscriptions[MAX_TOPIC_LENGTH * MAX_SUBSCRIPTIONS];
  int mqtt_subscription_count;
  int mqtt_subscribed_count;
  void (*registered_callback)(const char* topic, const byte* payload, const unsigned int length);
  bool was_connected;
  unsigned int count_loop;
};



#endif  // ESP8266__MQTT_H
