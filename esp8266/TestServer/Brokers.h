#ifndef ESP8266__DECODE_MDNS__H
#define ESP8266__DECODE_MDNS__H

#include <mdns.h>
#include "ipv4_helpers.h"
#include "html_primatives.h"

#define QUESTION_SERVICE "_mqtt._tcp.local"

#define MAX_BROKERS 4
#define MAX_BROKER_FAILURES 3
#define MDNS_QUESTION_INTERVAL 5

typedef struct Broker {
  String service_name;
  String host_name;
  IPAddress address;
  int port;
  unsigned int service_valid_until;
  unsigned int host_valid_until;
  unsigned int ipv4_valid_until;
  unsigned int fail_counter;
} Broker;


class Brokers {
 public:
  Brokers(const String service_type, mdns::MDns* mdns_instance) :
      service_type_(service_type),
      mdns_(mdns_instance), 
      itterator(0), 
      last_question_time(0) {};
  Brokers(const String service_type) :
      service_type_(service_type),
      itterator(0),
      last_question_time(0) {};
  void RegisterMDns(mdns::MDns* mdns_instance) { mdns_ = mdns_instance; }
  
  void SendQuestion();
  void ParseMDnsAnswer(const mdns::Answer* answer);
  Broker GetBroker();
  void RateBroker(bool sucess);
  String Summary();
  void SummarySerial();
 private:
  void CleanBuffer();
  const String service_type_;
  Broker brokers_[MAX_BROKERS];
  mdns::MDns* mdns_;
  unsigned int itterator;
  unsigned int last_question_time;
};



#endif  // ESP8266__DECODE_MDNS__H
