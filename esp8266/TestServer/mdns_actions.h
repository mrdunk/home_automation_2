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

/* This file and associated mdns_actions.cpp make use of the Arduino esp8266_mdns
 * library found here: https://github.com/mrdunk/esp8266_mdns
 * It makes use of the raw mDNS Answers returned by the esp8266_mdns and joins
 * them into usable Host entries.
 */

#ifndef ESP8266__DECODE_MDNS__H
#define ESP8266__DECODE_MDNS__H

#include <mdns.h>
#include "ipv4_helpers.h"


// The maximum number of entries found via mDNS that we can store.
#define HOSTS_BUFFER_SIZE 6

#define MIN_SUCESS_RATIO (9/10)

// Time between unsuccessful retries doubles up to a maximum of 60 seconds.
#define MDNS_QUESTION_INTERVAL 2

#define MANUAL_SERVICE_NAME "##manually_added##"

struct Host {
  String service_name;
  String host_name;
  IPAddress address;
  int port;
  unsigned int service_valid_until;
  unsigned int host_valid_until;
  unsigned int ipv4_valid_until;
  unsigned int sucess_counter;
  unsigned int fail_counter;
};


class MdnsLookup {
 public:
  MdnsLookup(const String service_type_, mdns::MDns* mdns_instance) :
      service_type(service_type_),
      mdns(mdns_instance), 
      active_host(0), 
      iterator(0), 
      last_question_time(0),
      retransmit_in(MDNS_QUESTION_INTERVAL) {}
  MdnsLookup(const String service_type) :
      service_type(service_type),
      active_host(0),
      iterator(0), 
      last_question_time(0),
      retransmit_in(MDNS_QUESTION_INTERVAL) {}
 
  // If MDns instance was not passed to the constructor it can be passed using this.
  void RegisterMDns(mdns::MDns* mdns_instance) { mdns = mdns_instance; }
 
  // Insert a manually configured entry into the buffer.
  void InsertManual(String host_name, IPAddress address, int port);

  // Send an mDNS query requesting service_type.
  void SendQuestion();

  // Populate hosts from provided mDNS answer.
  // Will try to join different Queries into a single hosts[] entry.
  void ParseMDnsAnswer(const mdns::Answer* answer);

  // Get a host from buffer.
  Host GetHost();
  
  // Track reliability of Host using the Host.success_counter and Host.fail_counter.
  // Call this with the success/failure of using the device found so CleanBuffer()
  // knows which entries to purge if more entries than buffer space arrive.
  void RateHost(bool sucess);

  // Iterate through hosts.
  // Returns: true if valid Host is found.
  //          false if the end of the array is reached.
  bool IterateHosts(Host** host, bool* active);

 private:
  void CleanBuffer();
  bool HostValid(Host& host);
  bool HostNotTImedOut(Host& host);
  const String service_type;
  Host hosts[HOSTS_BUFFER_SIZE];
  mdns::MDns* mdns;
  unsigned int active_host;
  unsigned int iterator;
  unsigned int last_question_time;
  unsigned int retransmit_in;
};



#endif  // ESP8266__DECODE_MDNS__H
