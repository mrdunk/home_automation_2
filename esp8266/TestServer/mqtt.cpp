#include "mqtt.h"
#include "devices.h"
#include "host_attributes.h"

// TODO. These externs are lazy.
// I should really come up with a proper way of passing data between objects.
extern Io io;
extern Config config;

Mqtt::Mqtt(WiFiClient& wifi_client, Brokers* brokers_){
  mqtt_client = PubSubClient(wifi_client);
  brokers = brokers_;
  mqtt_subscription_count = 0;
  mqtt_subscribed_count = 0;
  was_connected = false;
}

void Mqtt::loop(){
  if (!connected()) {
    if (was_connected){
      Serial.println("MQTT disconnected.");
      was_connected = false;
    }
    connect();
    Serial.print("-");
    delay(10);
  } else {
    if (!was_connected){
      // Serial.println("MQTT connected.");
      was_connected = true;
    }
    subscribeOne();
    mqtt_client.loop();
  }
}

void Mqtt::parse_topic(const char* topic, Address_Segment* address_segments){
  // We only care about the part of the topic without the prefix
  // so check how many segments there are in config.subscribe_prefix
  // so we can ignore that many segments later.
  int i, segment = 0;
  if(strlen(config.subscribe_prefix)){
    for (i=0, segment=-1; config.subscribe_prefix[i]; i++){
      segment -= (config.subscribe_prefix[i] == '/');
    }
  }

  // Casting non-const here as we don't actually modify topic.
  char* p_segment_start = (char*)topic;
  char* p_segment_end = strchr(topic, '/');
  while(p_segment_end != NULL){
    if(segment >= 0){
      int segment_len = p_segment_end - p_segment_start;
      if(segment_len > NAME_LEN){
        segment_len = NAME_LEN;
      }
      strncpy(address_segments[segment].segment, p_segment_start, segment_len);
      address_segments[segment].segment[segment_len] = '\0';
    }
    p_segment_start = p_segment_end +1;
    p_segment_end = strchr(p_segment_start, '/');
    segment++;
  }
  strncpy(address_segments[segment++].segment, p_segment_start, NAME_LEN);
  
  for(; segment < ADDRESS_SEGMENTS; segment++){
    address_segments[segment].segment[0] = '\0';
  }
}

bool Mqtt::compare_addresses(const Address_Segment* address_1, const Address_Segment* address_2){
  if(strlen(address_2[0].segment) <= 0){
    return false;
  }
  if(strcmp(address_1[0].segment, "_all") != 0 &&
      strcmp(address_1[0].segment, address_2[0].segment) != 0){
    return false;
  }
  for(int s=1; s < ADDRESS_SEGMENTS; s++){
    if(strcmp(address_1[s].segment, "_all") == 0){
      return true;
    }
    if(strcmp(address_1[s].segment, address_2[s].segment) != 0){
      return false;
    }
  }
  return true;
}

String Mqtt::value_from_payload(const byte* payload, const unsigned int length, const String key) {
  String buffer;
  int index = 0;
  for (int i = 0; i < length; i++) {
    buffer += (char)payload[i];
  }
  buffer.trim();
  
  while(buffer.length()){
    index = buffer.indexOf(",", index);
    if(index < 0){
      index = buffer.length();
    }
    String substring = buffer.substring(0, index);
    int seperator_pos = substring.indexOf(":");
    if(seperator_pos > 0){
      String k = substring.substring(0, seperator_pos);
      String v = substring.substring(seperator_pos +1);
      k.trim();
      v.trim();
      if(k == key){
        return v;
      }
    }

    buffer = buffer.substring(index +1);
    buffer.trim();
  }

  return "";
}

// Called whenever a MQTT topic we are subscribed to arrives.
void Mqtt::callback(const char* topic, const byte* payload, const unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  for (int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
  }
  Serial.println();
  
  Address_Segment address_segments[ADDRESS_SEGMENTS];
  parse_topic(topic, address_segments);

  String command = value_from_payload(payload, length, "_command");

  if(strncmp(address_segments[0].segment, "hosts", NAME_LEN) == 0 ||
      strncmp(address_segments[0].segment, "_all", NAME_LEN) == 0)
  {
    if(command == "solicit"){
      //Serial.println("Announce host.");
      mqtt_announce_host();
    }
  }

  for (int i = 0; i < MAX_DEVICES; ++i) {
      if(compare_addresses(address_segments, config.devices[i].address_segment)){
          //Serial.print("Matches: ");
          //Serial.println(i);

          if(command == ""){
            // pass
          } else if(command == "solicit"){
            io.mqttAnnounce(config.devices[i]);
          } else {
            io.changeState(config.devices[i], command);
          }          
      }
  }
}

void Mqtt::mqtt_announce_host(){
  // TODO Make this use mqtt_announce().
  uint8_t mac[6];
  WiFi.macAddress(mac);
  String parsed_mac = macToStr(mac);;
  parsed_mac.replace(":", "_");
  String announce = "_subject:";
  announce += parsed_mac;

  announce += ", _hostname:";
  announce += config.hostname;
  announce += ", _ip:";
  announce += ip_to_string(WiFi.localIP());
  char host[60 + HOSTNAME_LEN];  // eg: "_subject:AA_BB_CC_DD_EE_FF, _hostname:somehost, ip:123.123.123.123"
  announce.toCharArray(host, 60 + HOSTNAME_LEN);

  String address_string = config.publish_prefix;
  address_string += "/hosts/_announce";
  char address_char[PREFIX_LEN + 17];  // eg: "pre/fix/hosts/_announce"
  address_string.toCharArray(address_char, PREFIX_LEN + 17);

  mqtt_client.publish(address_char, host);
}

void Mqtt::announce(const String topic, const String payload){
  char topic_char[topic.length() +1];
  topic.toCharArray(topic_char, topic.length() +1);

  char payload_char[payload.length() +1];
  payload.toCharArray(payload_char, payload.length() +1);

  mqtt_client.publish(topic_char, payload_char);
}

void Mqtt::queue_mqtt_subscription(const char* path){
  for(int i = 0; i < mqtt_subscription_count; i++){
    if(strncmp(&mqtt_subscriptions[i * MAX_TOPIC_LENGTH], path, MAX_TOPIC_LENGTH) == 0){
      return;
    }
  }
  if(mqtt_subscription_count < MAX_SUBSCRIPTIONS){
    Serial.print(mqtt_subscription_count);
    Serial.print(" ");
    Serial.println(path);
    strncpy(&mqtt_subscriptions[mqtt_subscription_count * MAX_TOPIC_LENGTH], path, MAX_TOPIC_LENGTH -1);
    mqtt_subscription_count++;
  } else {
    Serial.println("Error. Too many subscriptions.");
  }
  return;
}

void Mqtt::subscribeOne(){
  if(mqtt_subscription_count > mqtt_subscribed_count){
    Serial.print("* ");
    Serial.println(&mqtt_subscriptions[mqtt_subscribed_count * MAX_TOPIC_LENGTH]);
    mqtt_client.subscribe(&mqtt_subscriptions[mqtt_subscribed_count * MAX_TOPIC_LENGTH]);
    mqtt_subscribed_count++;
  }
}

void Mqtt::mqtt_clear_buffers(){
  for(int i = 0; i < MAX_SUBSCRIPTIONS; i++){
    mqtt_subscriptions[i * MAX_TOPIC_LENGTH] = '\0';
  }
  mqtt_subscription_count = 0;
  mqtt_subscribed_count = 0;
}

// Called whenever we want to make sure we are subscribed to necessary topics.
void Mqtt::connect() {
  Broker broker = brokers->GetBroker();
  IPAddress ip = broker.address;
  if(ip == IPAddress(0,0,0,0)){
    if(config.ip == IPAddress(0,0,0,0)){
      // Can't find a Broker being advertised by mDNS so use configured one.
      ip = config.ip;
    } else {
      return;
    } 
  }
  mqtt_client.setServer(ip, 1883);
  mqtt_client.setCallback(registered_callback);

  if (mqtt_client.connect(config.hostname)) {
    if(mqtt_subscribed_count > 0){
      // In the event this is a re-connection, clear the subscription buffer.
      mqtt_clear_buffers();
    }

    char address[MAX_TOPIC_LENGTH];
   
    strncpy(address, config.subscribe_prefix, MAX_TOPIC_LENGTH -1);
    strncat(address, "/_all/_all", MAX_TOPIC_LENGTH -1 -strlen(address));
    queue_mqtt_subscription(address);
    
    strncpy(address, config.subscribe_prefix, MAX_TOPIC_LENGTH -1);
    strncat(address, "/hosts/_all", MAX_TOPIC_LENGTH -1 - strlen(address));
    queue_mqtt_subscription(address);

    strncpy(address, config.subscribe_prefix, MAX_TOPIC_LENGTH -1);
    strncat(address, "/hosts/", MAX_TOPIC_LENGTH -1 - strlen(address));
    strncat(address, config.hostname, MAX_TOPIC_LENGTH -1 - strlen(address));
    queue_mqtt_subscription(address);

    for (int i = 0; i < MAX_DEVICES; ++i) {
      if (strlen(config.devices[i].address_segment[0].segment) > 0) {
        io.mqttAnnounce(config.devices[i]);

        strncpy(address, config.subscribe_prefix, MAX_TOPIC_LENGTH -1);
        strncat(address, "/_all", MAX_TOPIC_LENGTH -1 - strlen(address));

        for(int j = 0; j < ADDRESS_SEGMENTS; j++){
          if(strlen(config.devices[i].address_segment[j].segment) <= 0) {
            break;
          }
          address[strlen(address) -4] = '\0';
          strncat(address, config.devices[i].address_segment[j].segment,
                  MAX_TOPIC_LENGTH -1 - strlen(address));
          if (j < (ADDRESS_SEGMENTS -1) &&
              strlen(config.devices[i].address_segment[j +1].segment) > 0) {
            strncat(address, "/_all", MAX_TOPIC_LENGTH -1 - strlen(address));
          }
          queue_mqtt_subscription(address);
        }
      }
    }
  }
  brokers->RateBroker(mqtt_client.connected());
  if (mqtt_client.connected()) {
    Serial.print("MQTT connected to: ");
    Serial.println(broker.address);
    mqtt_announce_host();
  }
}

