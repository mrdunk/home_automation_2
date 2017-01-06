#include <mdns.h>
#include "Brokers.h"
#include "ipv4_helpers.h"


void Brokers::SendMDnsQuestion() {
  const unsigned int now = millis() / 1000;
  if (last_mdns_question_time > 0 and last_mdns_question_time + MDNS_QUESTION_INTERVAL > now) {
    return;
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
  const unsigned int now = millis() / 1000;

  // Remove expired entries.
  for (int i = 0; i < MAX_BROKERS; ++i) {
    if ((brokers_[i].service_valid_until < now and brokers_[i].service_valid_until > 0) or 
        (brokers_[i].host_valid_until < now and brokers_[i].host_valid_until > 0))
    {
    //if ((brokers_[i].service_valid_until < now) or (brokers_[i].host_valid_until < now)){
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
    bool found = false;
    for (; i < MAX_BROKERS; ++i) {
      if (brokers_[i].service_name == answer->rdata_buffer) {
        // Already in brokers_[].
        // Note that there may be more than one match. (Same host, different IP.)
        if (now + answer->rrttl > brokers_[i].service_valid_until) {
          brokers_[i].service_valid_until = now + answer->rrttl;
        }
        found = true;
      }
    }
    if(!found){
      // Didn't find any matching entries so insert it in a blank space.
      i = 0;
      for (; i < MAX_BROKERS; ++i) {
        if (brokers_[i].service_name == "") {
          // This brokers[][] entry is still empty.
          brokers_[i].service_name = answer->rdata_buffer;
          if (now + answer->rrttl > brokers_[i].service_valid_until) {
            brokers_[i].service_valid_until = now + answer->rrttl;
          }
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
  }

  // A typical SRV record matches a human readable name to port and FQDN info.
  // eg:
  //  name:    Mosquitto MQTT server on twinkle.local
  //  data:    p=0;w=0;port=1883;host=twinkle.local
  if (answer->rrtype == MDNS_TYPE_SRV) {
    bool exists = false;
    for (int i = 0; i < MAX_BROKERS; ++i) {
      if (brokers_[i].service_name == answer->name_buffer) {
        // This brokers entry matches the name of the host we are looking for
        // so parse data for port and hostname.
        // Note that there may be more than one match. (Same host, different IP.)
        exists = true;
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
            }
          }
        }
      }
    }
    if (!exists) {
      /*Serial.print(" SRV.  Did not find ");
      Serial.print('"');
      Serial.print(answer->name_buffer);
      Serial.print('"');
      Serial.println(" in brokers buffer.");*/
    }
  }

  // A typical A record matches an FQDN to network ipv4 address.
  // eg:
  //   name:    twinkle.local
  //   address: 192.168.192.9
  if (answer->rrtype == MDNS_TYPE_A) {
    bool exists = false;
    int empty_slot = -1;
    for (int i = 0; i < MAX_BROKERS; ++i) {
      if (brokers_[i].host_name == answer->name_buffer) {
        // Hostname matches.
        if (brokers_[i].address == string_to_ip(answer->rdata_buffer)) {
          // This entry with matching hostname already has the advertised ipv4 address.
          // Note that more than one entry with a matching hostname and IP address could exist.
          // (ie, different service name on the same host.)
          exists = true;
          if (now + answer->rrttl > brokers_[i].host_valid_until) {
            brokers_[i].host_valid_until = now + answer->rrttl;
          }
        } else if(brokers_[i].address == IPAddress(0, 0, 0, 0)) {
          // Hostname matches but IP has not been set yet.
          // Lets do that now.
          exists = true;
          brokers_[i].address = string_to_ip(answer->rdata_buffer);
          if (now + answer->rrttl > brokers_[i].host_valid_until) {
            brokers_[i].host_valid_until = now + answer->rrttl;
          }
        } else {
          // The hostname matches but the address does not.
          // This is probably a host with more than one IP address.
          // Check for a match elsewhere in the buffer:
          for (int j = 0; j < MAX_BROKERS; ++j) {
            if(i != j &&
                brokers_[j].host_name == answer->name_buffer &&
                brokers_[j].address == string_to_ip(answer->rdata_buffer))
            {
              // Found match elsewhere in the buffer.
              exists = true;
              if (now + answer->rrttl > brokers_[j].host_valid_until) {
                brokers_[j].host_valid_until = now + answer->rrttl;
              }
              break;
            } else if (brokers_[j].host_name == "") {
              // Track empty slot so we can use it later.
              if(empty_slot < 0){
                empty_slot = j;
              }
            }
          }

          if(!exists){
            if(empty_slot >= 0){
              brokers_[empty_slot].service_name = brokers_[i].service_name;
              brokers_[empty_slot].host_name = brokers_[i].host_name;
              brokers_[empty_slot].port = brokers_[i].port;
              brokers_[empty_slot].service_valid_until = brokers_[i].service_valid_until;
              brokers_[empty_slot].address = string_to_ip(answer->rdata_buffer);
              if (now + answer->rrttl > brokers_[empty_slot].host_valid_until) {
                brokers_[empty_slot].host_valid_until = now + answer->rrttl;
              }
              exists = true;
            } else {
              Serial.print(" ** ERROR ** No space in buffer to copy record with "
                  "duplicate ipv4 address: ");
              Serial.println(brokers_[i].service_name);
            }
          }
        }
      } else if (brokers_[i].host_name == "") {
        // Empty slot.
        if(empty_slot < 0){
          empty_slot = i;
        }
      }
    }
    if (!exists) {
      /*Serial.print(" A.    Did not find ");
      Serial.print('"');
      Serial.print(answer->name_buffer);
      Serial.print('"');
      Serial.println(" in brokers buffer.");*/
    }
  }

}

Broker Brokers::GetBroker() {
  const unsigned int now = millis() / 1000;
  while (brokers_[itterator].address == IPAddress(0, 0, 0, 0) and
         brokers_[itterator].host_valid_until < now and
         brokers_[itterator].fail_counter < MAX_BROKER_FAILURES)
  {
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
  GetBroker();
  const String now = String(millis() / 1000);
  String rows = row(header("") + header("service_name") + header("port") +
                    header("hostname") + header("ip") + header("service valid until") +
                    header("host valid until") + header("fail counter"), "");
  for (int i = 0; i < MAX_BROKERS; ++i) {
    if (brokers_[i].service_name != "") {
      String cells = "";
      if(i == itterator){
        cells += cell(" active ");
      } else {
        cells += cell(" ");
      }
      cells += cell(brokers_[i].service_name);
      cells += cell(String(brokers_[i].port));
      cells += cell(brokers_[i].host_name);
      cells += cell(ip_to_string(brokers_[i].address));
      cells += cell(String(brokers_[i].service_valid_until));
      cells += cell(String(brokers_[i].host_valid_until));
      cells += cell(String(brokers_[i].fail_counter));
      if(i == itterator){
        rows += (row(cells, "highlight"));
      } else {
        rows += row(cells, "");
      }
    }
  }
  return table(rows);
}
