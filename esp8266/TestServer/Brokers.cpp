#include <mdns.h>
#include "Brokers.h"
#include "ipv4_helpers.h"


void Brokers::SendMDnsQuestion() {
  const unsigned int now = millis() / 1000;
  if (last_mdns_question_time > 0 and last_mdns_question_time + MDNS_QUESTION_INTERVAL > now) {
    //return;
  }
  last_mdns_question_time = now;
  Serial.print("Sending mDNS question at ");
  Serial.println(now);

  mdns_.Clear();
  struct mdns::Query query_mqtt;
  service_type_.toCharArray(query_mqtt.qname_buffer, MAX_MDNS_NAME_LEN);
  query_mqtt.qtype = MDNS_TYPE_PTR;
  query_mqtt.qclass = 1;    // "INternet"
  query_mqtt.unicast_response = 0;
  mdns_.AddQuery(query_mqtt);
  mdns_.Send();
}

void Brokers::ParseMDnsAnswer(const mdns::Answer* answer) {
  bool updated = false;
  const unsigned int now = millis() / 1000;

  // Remove expired entries.
  for (int i = 0; i < MAX_BROKERS; ++i) {
    if ((brokers_[i].service_valid_until < now and brokers_[i].service_valid_until > 0) or 
        (brokers_[i].host_valid_until < now and brokers_[i].host_valid_until > 0)) {
      brokers_[i].service_name = "";
      brokers_[i].host_name = "";
      brokers_[i].port = 0;
      brokers_[i].address = IPAddress(0, 0, 0, 0);
    }
  }

  // A typical PTR record matches service to a human readable name.
  // eg:
  //  service: _mqtt._tcp.local
  //  name:    Mosquitto MQTT server on twinkle.local
  if (answer->rrtype == MDNS_TYPE_PTR and strstr(answer->name_buffer, QUESTION_SERVICE) != 0) {
    unsigned int i = 0;
    for (; i < MAX_BROKERS; ++i) {
      if (brokers_[i].service_name == answer->rdata_buffer) {
        // Already in brokers_[].
        if (now + answer->rrttl > brokers_[i].service_valid_until) {
          brokers_[i].service_valid_until = now + answer->rrttl;
        }
        break;
      }
      if (brokers_[i].service_name == "") {
        // This brokers[][] entry is still empty.
        brokers_[i].service_name = answer->rdata_buffer;
        if (now + answer->rrttl > brokers_[i].service_valid_until) {
          brokers_[i].service_valid_until = now + answer->rrttl;
        }
        updated = true;
        break;
      }
    }
    if (i == MAX_BROKERS) {
      Serial.print(" ** ERROR ** No space in buffer for ");
      Serial.print('"');
      Serial.print(answer->name_buffer);
      Serial.print('"');
      Serial.print("  :  ");
      Serial.print('"');
      Serial.println(answer->rdata_buffer);
      Serial.print('"');
    }
  }

  // A typical SRV record matches a human readable name to port and FQDN info.
  // eg:
  //  name:    Mosquitto MQTT server on twinkle.local
  //  data:    p=0;w=0;port=1883;host=twinkle.local
  if (answer->rrtype == MDNS_TYPE_SRV) {
    unsigned int i = 0;
    for (; i < MAX_BROKERS; ++i) {
      if (brokers_[i].service_name == answer->name_buffer) {
        // This brokers entry matches the name of the host we are looking for
        // so parse data for port and hostname.
        char* port_start = strstr(answer->rdata_buffer, "port=");
        if (port_start) {
          port_start += 5;
          char* port_end = strchr(port_start, ';');
          char port[1 + port_end - port_start];
          strncpy(port, port_start, port_end - port_start);
          port[port_end - port_start] = '\0';

          if (port_end) {
            char* host_start = strstr(port_end, "host=");
            if (host_start) {
              host_start += 5;
              String str_port = port;
              brokers_[i].port = str_port.toInt();
              brokers_[i].host_name = host_start;
              if (now + answer->rrttl > brokers_[i].host_valid_until) {
                brokers_[i].host_valid_until = now + answer->rrttl;
              }
              updated = true;
            }
          }
        }
        break;
      }
    }
    if (i == MAX_BROKERS) {
      Serial.print(" SRV.  Did not find ");
      Serial.print('"');
      Serial.print(answer->name_buffer);
      Serial.print('"');
      Serial.println(" in brokers buffer.");
    }
  }

  // A typical A record matches an FQDN to network ipv4 address.
  // eg:
  //   name:    twinkle.local
  //   address: 192.168.192.9
  if (answer->rrtype == MDNS_TYPE_A) {
    int i = 0;
    for (; i < MAX_BROKERS; ++i) {
      if (brokers_[i].host_name == answer->name_buffer) {
        // Hostname matches.
        if (brokers_[i].address == string_to_ip(answer->rdata_buffer)) {
          // Already up-to-date.
          if (now + answer->rrttl > brokers_[i].host_valid_until) {
            brokers_[i].host_valid_until = now + answer->rrttl;
          }
          updated = true;  // TODO remove me once we know "host_valid_until" is getting updated correclty.
          break;
        } else if (brokers_[i].address != IPAddress(0, 0, 0, 0)) {
          // Already have an IP address for this entry.
          // It appears more than one address is advertised for this Host.
          // Make a duplicate entry with the new address.
          int j = 0;
          for (; j < MAX_BROKERS; ++j) {
            if (brokers_[j].service_name == "") {
              // Here's an empty slot in the buffer. Copy the record here and give it the new IP Address.
              brokers_[j].service_name = brokers_[i].service_name;
              brokers_[j].host_name = brokers_[i].host_name;
              brokers_[j].port = brokers_[i].port;
              brokers_[j].service_valid_until = brokers_[i].service_valid_until;
              brokers_[j].address = string_to_ip(answer->rdata_buffer);
              if (now + answer->rrttl > brokers_[i].host_valid_until) {
                brokers_[i].host_valid_until = now + answer->rrttl;
              }
              updated = true;
              break;
            }
          }
          if (j == MAX_BROKERS) {
            // Didn't find an empty space in buffer so let's just overwrite the old address.
            brokers_[i].address = string_to_ip(answer->rdata_buffer);
            if (now + answer->rrttl > brokers_[i].host_valid_until) {
              brokers_[i].host_valid_until = now + answer->rrttl;
            }
            updated = true;
            break;
          }
        } else {
          // IP Address not set for this entry yet so do that now.
          brokers_[i].address = string_to_ip(answer->rdata_buffer);
          if (now + answer->rrttl > brokers_[i].host_valid_until) {
            brokers_[i].host_valid_until = now + answer->rrttl;
          }
          updated = true;
          break;
        }
      }
    }
    if (i == MAX_BROKERS) {
      Serial.print(" A.    Did not find ");
      Serial.print('"');
      Serial.print(answer->name_buffer);
      Serial.print('"');
      Serial.println(" in brokers buffer.");
    }
  }

  if (updated) {
    Serial.println(Summary());
  }
}

Broker Brokers::GetBroker() {
  const unsigned int now = millis() / 1000;
  while (brokers_[itterator].address == IPAddress(0, 0, 0, 0) and
         brokers_[itterator].host_valid_until < now and
         brokers_[itterator].fail_counter < MAX_BROKER_FAILURES) {
    if (++itterator == MAX_BROKERS) {
      itterator = 0;
      SendMDnsQuestion();
      return Broker{};
    }
  }
  return brokers_[itterator];
}

void Brokers::RateBroker(bool sucess) {
  if (sucess) {
    brokers_[itterator].fail_counter = 0;
    return;
  }
  brokers_[itterator].fail_counter++;
}

String Brokers::Summary() {
  const unsigned int now = millis() / 1000;
  String return_string = "";
  return_string += "time: ";
  return_string += now;
  return_string += "\n";
  for (int i = 0; i < MAX_BROKERS; ++i) {
    if (brokers_[i].service_name != "") {
      return_string += ">  ";
      return_string += brokers_[i].service_name;
      return_string += "    ";
      return_string += brokers_[i].port;
      return_string += "    ";
      return_string += brokers_[i].host_name;
      return_string += "    ";
      return_string += ip_to_string(brokers_[i].address);
      return_string += "    ";
      return_string += brokers_[i].service_valid_until;
      return_string += "    ";
      return_string += brokers_[i].host_valid_until;
      return_string += "    ";
      return_string += brokers_[i].fail_counter;
      return_string += "\n";
    }
  }
  return return_string;
}

