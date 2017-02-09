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

#include "mdns_actions.h"


void MdnsLookup::SendQuestion() {
  const unsigned int now = millis();
  if (last_question_time > 0 && 
      last_question_time + (retransmit_in * 1000) > now) {
    return;
  }
  last_question_time = now;
  Serial.print("Sending mDNS question at ");
  Serial.print(now);
  Serial.println("ms.");

  mdns->Clear();
  mdns::Query query_mqtt;
  service_type.toCharArray(query_mqtt.qname_buffer, MAX_MDNS_NAME_LEN);
  query_mqtt.qtype = MDNS_TYPE_PTR;
  query_mqtt.qclass = 1;    // "INternet"
  query_mqtt.unicast_response = 0;
  mdns->AddQuery(query_mqtt);
  mdns->Send();

  // Double time between retransmissions but cap at 1 minute.
  retransmit_in *= 2;
  if(retransmit_in > 60){
    retransmit_in = 60;
  }
}

void MdnsLookup::ParseMDnsAnswer(const mdns::Answer* answer) {
  const unsigned int now = millis() / 1000;

  // A typical PTR record matches service to a human readable name.
  // eg:
  //  service: _mqtt._tcp.local
  //  name:    Mosquitto MQTT server on twinkle.local
  char service_type_char[service_type.length() +1];
  service_type.toCharArray(service_type_char, service_type.length());
  if (answer->rrtype == MDNS_TYPE_PTR and strstr(answer->name_buffer, service_type_char) != NULL) {
    unsigned int i = 0;
    bool found = false;
    for (; i < MAX_BROKERS; ++i) {
      if (hosts[i].service_name == String(answer->rdata_buffer)) {
        // Already in hosts[].
        // Note that there may be more than one match. (Same host, different IP.)
        if (now + answer->rrttl > hosts[i].service_valid_until) {
          hosts[i].service_valid_until = now + answer->rrttl;
        }
        found = true;
      }
    }
    if(!found){
      // Didn't find any matching entries so insert it in a blank space.
      i = 0;
      for (; i < MAX_BROKERS; ++i) {
        if (hosts[i].service_name == "") {
          // This hosts[][] entry is still empty.
          hosts[i].service_name = answer->rdata_buffer;
          if (now + answer->rrttl > hosts[i].service_valid_until) {
            hosts[i].service_valid_until = now + answer->rrttl;
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
      if (hosts[i].service_name == String(answer->name_buffer)) {
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
              hosts[i].port = str_port.toInt();
              hosts[i].host_name = host_start;
              if (now + answer->rrttl > hosts[i].host_valid_until) {
                hosts[i].host_valid_until = now + answer->rrttl;
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
      if (hosts[i].host_name == String(answer->name_buffer)) {
        // Hostname matches.
        if (hosts[i].address == string_to_ip(answer->rdata_buffer)) {
          // This entry with matching hostname already has the advertised ipv4 address.
          // Note that more than one entry with a matching hostname and IP address could exist.
          // (ie, different service name on the same host.)
          exists = true;
          if (now + answer->rrttl > hosts[i].ipv4_valid_until) {
            hosts[i].ipv4_valid_until = now + answer->rrttl;
          }
          break;
        } else if(hosts[i].address == IPAddress(0, 0, 0, 0)) {
          // Hostname matches but IP has not been set yet.
          // Lets do that now.
          exists = true;
          hosts[i].address = string_to_ip(answer->rdata_buffer);
          if (now + answer->rrttl > hosts[i].ipv4_valid_until) {
            hosts[i].ipv4_valid_until = now + answer->rrttl;
          }
          break;
        } else {
          // The hostname matches but the address does not.
          // This is probably a host with more than one IP address.
          // Check for a match elsewhere in the buffer:
          for (int j = 0; j < MAX_BROKERS; ++j) {
            if(i != j &&
                hosts[j].host_name == String(answer->name_buffer) &&
                hosts[j].address == string_to_ip(answer->rdata_buffer))
            {
              // Found match elsewhere in the buffer.
              exists = true;
              if (now + answer->rrttl > hosts[j].ipv4_valid_until) {
                hosts[j].ipv4_valid_until = now + answer->rrttl;
              }
              break;
            } else if (hosts[j].host_name == "") {
              // Track empty slot so we can use it later.
              if(empty_slot < 0){
                empty_slot = j;
              }
            }
          }

          if(!exists){
            if(empty_slot >= 0){
              hosts[empty_slot].service_name = hosts[i].service_name;
              hosts[empty_slot].host_name = hosts[i].host_name;
              hosts[empty_slot].port = hosts[i].port;
              hosts[empty_slot].service_valid_until = hosts[i].service_valid_until;
              hosts[empty_slot].host_valid_until = hosts[i].host_valid_until;
              hosts[empty_slot].address = string_to_ip(answer->rdata_buffer);
              hosts[empty_slot].ipv4_valid_until = now + answer->rrttl;
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
      } else if (hosts[i].host_name == "") {
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
void MdnsLookup::CleanBuffer(){
  const unsigned int now = millis() / 1000;
  for (int i = 0; i < MAX_BROKERS; ++i) {
    if ((hosts[i].service_valid_until < now and hosts[i].service_valid_until > 0) or 
        (hosts[i].host_valid_until < now and hosts[i].host_valid_until > 0) or
        (hosts[i].ipv4_valid_until < now and hosts[i].ipv4_valid_until > 0) or
        hosts[i].fail_counter > MAX_BROKER_FAILURES)
    {
      hosts[i].service_name = "";
      hosts[i].host_name = "";
      hosts[i].address = IPAddress(0, 0, 0, 0);
      hosts[i].port = 0;
      hosts[i].service_valid_until = 0;
      hosts[i].host_valid_until = 0;
      hosts[i].ipv4_valid_until = 0;
      hosts[i].fail_counter = 0;
    }
  }
}

Host MdnsLookup::GetHost() {
  // Remove any brokers that have a high number of failures or have timed out.
  CleanBuffer();

  const unsigned int now = millis() / 1000;
  const unsigned int starting_active_host = active_host;
  while (hosts[active_host].address == IPAddress(0, 0, 0, 0)){
    if (++active_host == MAX_BROKERS) {
      active_host = 0;
    }
    if(active_host == starting_active_host){
      // Haven't found a valid broker so try querying mDNS for the address of some.
      SendQuestion();
      return Host{};
    }
  }
  retransmit_in = MDNS_QUESTION_INTERVAL;
  return hosts[active_host];
}

void MdnsLookup::RateHost(bool sucess) {
  if (sucess) {
    hosts[active_host].fail_counter = 0;
    return;
  }
  hosts[active_host].fail_counter++;
}

bool MdnsLookup::IterateHosts(Host** host, bool* active){
  while(iterator < MAX_BROKERS){
    *active = (iterator == active_host);
    if(hosts[iterator].service_name != "") {
      *host = &(hosts[iterator]);
      iterator++;
      return true;
    }
    iterator++;
  }
  iterator = 0;
  return false;
}
