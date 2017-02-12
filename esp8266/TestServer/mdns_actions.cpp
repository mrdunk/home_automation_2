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


void MdnsLookup::InsertManual(String host_name, IPAddress address, int port) {
  for (int i = 0; i < HOSTS_BUFFER_SIZE; ++i) {
    if (hosts[i].service_name == "" and
        hosts[i].host_name == "" and
        hosts[i].address == IPAddress(0, 0, 0, 0) and
        hosts[i].port == 0 and
        hosts[i].service_valid_until == 0 and
        hosts[i].host_valid_until == 0 and
        hosts[i].ipv4_valid_until == 0 and
        hosts[i].fail_counter == 0)
    {
      // Empty slot so populate.
      hosts[i].service_name = String(MANUAL_SERVICE_NAME);
      hosts[i].host_name = String(host_name);
      hosts[i].address = address;
      hosts[i].port = port;
      break;
    }
  }
}

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
  //  name_buffer:  _mqtt._tcp.local
  //  rdata_buffer: Mosquitto MQTT server on twinkle.local
  if(answer->rrtype == MDNS_TYPE_PTR and 
      service_type == String(answer->name_buffer))
  {
    if(strncmp(answer->rdata_buffer, MANUAL_SERVICE_NAME, strlen(MANUAL_SERVICE_NAME) == 0)){
      // MANUAL_SERVICE_NAME should never appear via mDNS query.
      Serial.print("WARNING: mDNS query arrived with reserved service name: ");
      Serial.println(MANUAL_SERVICE_NAME);
      return;
    }
    unsigned int i = 0;
    bool found = false;
    for (; i < HOSTS_BUFFER_SIZE; ++i) {
      if (hosts[i].service_name == String(answer->rdata_buffer)) {
        // Already in hosts[].
        // Note that there may be more than one match.
        // (Same service, different IP or different host.)
        if (now + answer->rrttl > hosts[i].service_valid_until) {
          hosts[i].service_valid_until = now + answer->rrttl;
        }
        found = true;
      }
    }
    if(!found){
      // Didn't find any matching entries so insert it in a blank space.
      for (i = 0; i < HOSTS_BUFFER_SIZE; ++i) {
        if (hosts[i].service_name == "") {
          // This hosts[][] entry is still empty.
          hosts[i].service_name = answer->rdata_buffer;
          if (now + answer->rrttl > hosts[i].service_valid_until) {
            hosts[i].service_valid_until = now + answer->rrttl;
          }
          break;
        }
      }
      if (i == HOSTS_BUFFER_SIZE) {
        Serial.print("No space in buffer for ");
        Serial.print('"');
        Serial.print(answer->name_buffer);
        Serial.print('"');
        Serial.print("  :  ");
        Serial.print('"');
        Serial.println(answer->rdata_buffer);
        Serial.print('"');

        CleanBuffer();
      }
    }
  }

  // A typical SRV record matches a human readable name to port and FQDN info.
  // eg:
  //  name:    Mosquitto MQTT server on twinkle.local
  //  data:    p=0;w=0;port=1883;host=twinkle.local
  if (answer->rrtype == MDNS_TYPE_SRV) {
    bool exists = false;
    for (int i = 0; i < HOSTS_BUFFER_SIZE; ++i) {
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
      //Serial.print(" SRV.  Did not find ");
      //Serial.print('"');
      //Serial.print(answer->name_buffer);
      //Serial.print('"');
      //Serial.println(" in brokers buffer.");
    }
  }

  // A typical A record matches an FQDN to network ipv4 address.
  // eg:
  //   name:    twinkle.local
  //   address: 192.168.192.9
  if (answer->rrtype == MDNS_TYPE_A) {
    bool exists = false;
    int empty_slot = -1;
    for (int i = 0; i < HOSTS_BUFFER_SIZE; ++i) {
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
          for (int j = 0; j < HOSTS_BUFFER_SIZE; ++j) {
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
              Serial.print("No space in buffer for "
                  "duplicate ipv4 address: ");
              Serial.print(answer->rdata_buffer);
              Serial.print("  hosname: ");
              Serial.println(answer->name_buffer);

              CleanBuffer();
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
      //Serial.print(" A.    Did not find ");
      //Serial.print('"');
      //Serial.print(answer->name_buffer);
      //Serial.print('"');
      //Serial.println(" in brokers buffer.");
    }
  }

}

void MdnsLookup::CleanBuffer(){
  const unsigned int now = millis() / 1000;
  int worst_result = -1;
  float worst_ratio = 0;
  int total_samples;
 
  // Get worst expired result.
  for (int i = 0; i < HOSTS_BUFFER_SIZE; ++i) {
    total_samples = hosts[i].sucess_counter + hosts[i].fail_counter;
    if(total_samples == 0){
      // Prevent division by zero;
      total_samples++;
    }
    if((hosts[i].service_name != String(MANUAL_SERVICE_NAME)) and
        ((float)hosts[i].sucess_counter / total_samples <= worst_ratio) and
        (i != active_host) and
        !HostNotTImedOut(hosts[i]))
    {
      worst_ratio = (float)hosts[i].sucess_counter / total_samples;
      worst_result = i;
    }
  }

  if(worst_result < 0){
    // Since no entries have expired, just scrap the worst result.
    for (int i = 0; i < HOSTS_BUFFER_SIZE; ++i) {
      total_samples = hosts[i].sucess_counter + hosts[i].fail_counter;
      if(total_samples == 0){
        // Prevent division by zero;
        total_samples++;
      }
      if((hosts[i].service_name != String(MANUAL_SERVICE_NAME)) and
          ((float)hosts[i].sucess_counter / total_samples <= worst_ratio) and
          (i != active_host))
      {
        worst_ratio = (float)hosts[i].sucess_counter / total_samples;
        worst_result = i;
      }
    }
  }

  if(worst_result < 0 or 
      worst_ratio > MIN_SUCESS_RATIO or
      worst_ratio == 0){
    // None bad enough to scrap.
    return;
  }

  Serial.println("deleting entry from hosts buffer.");
  hosts[worst_result].service_name = "";
  hosts[worst_result].host_name = "";
  hosts[worst_result].address = IPAddress(0, 0, 0, 0);
  hosts[worst_result].port = 0;
  hosts[worst_result].service_valid_until = 0;
  hosts[worst_result].host_valid_until = 0;
  hosts[worst_result].ipv4_valid_until = 0;
  hosts[worst_result].fail_counter = 0;
}

bool MdnsLookup::HostValid(Host& host){
  return (host.address != IPAddress(0, 0, 0, 0)) and
         (host.port != 0);
}

bool MdnsLookup::HostNotTImedOut(Host& host){
  const unsigned int now = millis() / 1000;
  return ((host.service_valid_until >= now) and
          (host.host_valid_until >= now) and
          (host.ipv4_valid_until >= now));
}

Host MdnsLookup::GetHost() {
  const unsigned int now = millis() / 1000;
  int total_samples;
  int best_host = -1;
  float best_ratio = 0;

  // TODO: Check for buffer expiring..
  for (int i = 0; i < HOSTS_BUFFER_SIZE; ++i) {
    total_samples = hosts[i].sucess_counter + hosts[i].fail_counter;
    if(HostValid(hosts[i]) and HostNotTImedOut(hosts[i]) and
        ((total_samples == 0) or 
        ((float)hosts[i].sucess_counter / total_samples > best_ratio))){
      best_host = i;
      best_ratio = (float)hosts[i].sucess_counter / total_samples;
    }
  }

  if(best_host < 0){
    // Haven't found a host that has not timed out so let's ignore the timeouts.
    for (int i = 0; i < HOSTS_BUFFER_SIZE; ++i) {
      total_samples = hosts[i].sucess_counter + hosts[i].fail_counter;
      if(HostValid(hosts[i]) and
          ((total_samples == 0) or 
           ((float)hosts[i].sucess_counter / total_samples > best_ratio))){
        best_host = i;
        best_ratio = (float)hosts[i].sucess_counter / total_samples;
      }
    }
  }

  if(best_host < 0){
    // Didn't find one.
    return Host{};
  }
  active_host = best_host;
  return hosts[best_host];
}

void MdnsLookup::RateHost(bool sucess) {
  if (sucess) {
    hosts[active_host].sucess_counter++;
    return;
  }
  hosts[active_host].fail_counter++;
}

bool MdnsLookup::IterateHosts(Host** host, bool* active){
  while(iterator < HOSTS_BUFFER_SIZE){
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
