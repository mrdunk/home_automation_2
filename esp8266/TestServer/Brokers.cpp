#include "Brokers.h"


void Brokers::SendQuestion() {
  const unsigned int now = millis();
  if (last_question_time > 0 && 
      last_question_time + (MDNS_QUESTION_INTERVAL * 1000) > now) {
    return;
  }
  last_question_time = now;
  Serial.print("Sending mDNS question at ");
  Serial.println(now);

  mdns_->Clear();
  mdns::Query query_mqtt;
  service_type_.toCharArray(query_mqtt.qname_buffer, MAX_MDNS_NAME_LEN);
  query_mqtt.qtype = MDNS_TYPE_PTR;
  query_mqtt.qclass = 1;    // "INternet"
  query_mqtt.unicast_response = 0;
  mdns_->AddQuery(query_mqtt);
  mdns_->Send();
}

void Brokers::ParseMDnsAnswer(const mdns::Answer* answer) {
  const unsigned int now = millis() / 1000;

  // A typical PTR record matches service to a human readable name.
  // eg:
  //  service: _mqtt._tcp.local
  //  name:    Mosquitto MQTT server on twinkle.local
  if (answer->rrtype == MDNS_TYPE_PTR and strstr(answer->name_buffer, QUESTION_SERVICE) != NULL) {
    unsigned int i = 0;
    bool found = false;
    for (; i < MAX_BROKERS; ++i) {
      if (brokers_[i].service_name == String(answer->rdata_buffer)) {
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
      if (brokers_[i].service_name == String(answer->name_buffer)) {
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
      if (brokers_[i].host_name == String(answer->name_buffer)) {
        // Hostname matches.
        if (brokers_[i].address == string_to_ip(answer->rdata_buffer)) {
          // This entry with matching hostname already has the advertised ipv4 address.
          // Note that more than one entry with a matching hostname and IP address could exist.
          // (ie, different service name on the same host.)
          exists = true;
          if (now + answer->rrttl > brokers_[i].ipv4_valid_until) {
            brokers_[i].ipv4_valid_until = now + answer->rrttl;
          }
          break;
        } else if(brokers_[i].address == IPAddress(0, 0, 0, 0)) {
          // Hostname matches but IP has not been set yet.
          // Lets do that now.
          exists = true;
          brokers_[i].address = string_to_ip(answer->rdata_buffer);
          if (now + answer->rrttl > brokers_[i].ipv4_valid_until) {
            brokers_[i].ipv4_valid_until = now + answer->rrttl;
          }
          break;
        } else {
          // The hostname matches but the address does not.
          // This is probably a host with more than one IP address.
          // Check for a match elsewhere in the buffer:
          for (int j = 0; j < MAX_BROKERS; ++j) {
            if(i != j &&
                brokers_[j].host_name == String(answer->name_buffer) &&
                brokers_[j].address == string_to_ip(answer->rdata_buffer))
            {
              // Found match elsewhere in the buffer.
              exists = true;
              if (now + answer->rrttl > brokers_[j].ipv4_valid_until) {
                brokers_[j].ipv4_valid_until = now + answer->rrttl;
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
              brokers_[empty_slot].host_valid_until = brokers_[i].host_valid_until;
              brokers_[empty_slot].address = string_to_ip(answer->rdata_buffer);
              brokers_[empty_slot].ipv4_valid_until = now + answer->rrttl;
              exists = true;
              break;
            } else {
              Serial.print(" ** ERROR ** No space in buffer for "
                  "duplicate ipv4 address: ");
              Serial.print(answer->rdata_buffer);
              Serial.print("  hosname: ");
              Serial.println(answer->name_buffer);
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

// Remove expired or failed entries.
void Brokers::CleanBuffer(){
  const unsigned int now = millis() / 1000;
  for (int i = 0; i < MAX_BROKERS; ++i) {
    if ((brokers_[i].service_valid_until < now and brokers_[i].service_valid_until > 0) or 
        (brokers_[i].host_valid_until < now and brokers_[i].host_valid_until > 0) or
        (brokers_[i].ipv4_valid_until < now and brokers_[i].ipv4_valid_until > 0) or
        brokers_[i].fail_counter > MAX_BROKER_FAILURES)
    {
      brokers_[i].service_name = "";
      brokers_[i].host_name = "";
      brokers_[i].address = IPAddress(0, 0, 0, 0);
      brokers_[i].port = 0;
      brokers_[i].service_valid_until = 0;
      brokers_[i].host_valid_until = 0;
      brokers_[i].ipv4_valid_until = 0;
      brokers_[i].fail_counter = 0;
    }
  }
}

// Get a reachable MQTT broker address from buffer.
Broker Brokers::GetBroker() {
  // Remove any brokers that have a high number of failures or have timed out.
  CleanBuffer();

  const unsigned int now = millis() / 1000;
  const unsigned int starting_itterator = itterator;
  while (brokers_[itterator].address == IPAddress(0, 0, 0, 0)){
    if (++itterator == MAX_BROKERS) {
      itterator = 0;
    }
    if(itterator == starting_itterator){
      // Haven't found a valid broker so try querying mDNS for the address of some.
      SendQuestion();
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
  String return_value = tableStart() + rowStart("");
  return_value += header("") + header("") + header("service_name") + header("port") +
                  header("hostname") + header("ip") + header("service valid until") +
                  header("host valid until") + header("ipv4 valid until") +
                  header("fail counter") +
                  rowEnd();
  for (int i = 0; i < MAX_BROKERS; ++i) {
    if (brokers_[i].service_name != "") {
      if(i == itterator){
        return_value += rowStart("highlight");
      } else {
        return_value += rowStart("");
      }

      return_value += cell(String(i));
      if(i == itterator){
        return_value += cell(" active ");
      } else {
        return_value += cell(" ");
      }
      return_value += cell(brokers_[i].service_name);
      return_value += cell(String(brokers_[i].port));
      return_value += cell(brokers_[i].host_name);
      return_value += cell(ip_to_string(brokers_[i].address));
      return_value += cell(String(brokers_[i].service_valid_until));
      return_value += cell(String(brokers_[i].host_valid_until));
      return_value += cell(String(brokers_[i].ipv4_valid_until));
      return_value += cell(String(brokers_[i].fail_counter));

      return_value += rowEnd();
    }
  }

  return_value += tableEnd();
  
  return return_value;
}
