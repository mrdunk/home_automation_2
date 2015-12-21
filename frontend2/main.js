/*global BROKER_ADDRESS*/ 
/*global BROKER_PORT*/ 
/*global ANNOUNCE_SUBSCRIPTION*/ 
/*global USE_TLS*/ 
/*global CLEANSESSION*/ 
/*global username*/ 
/*global password*/ 
/*global MQTT_CACHE_TIME*/

/*global Messaging*/

/*global dataReceived*/

var Page = {};

Page.init = function() {
  'use strict';
  Page.running_ = true;
  Page.fps_ = 10;
  Page.topics = {};
  Page.topics.all_devices = 'homeautomation/0/_all/_all';
};

Page.run = function() {
  'use strict';
};

Page.exit = function() {
  'use strict';
  clearInterval(Page._intervalId_);
};

var Data = { mqtt_data: {} };

Data.storeIncomingMqtt = function(topic, data) {
  'use strict';
  if(topic === undefined || data === undefined) {
    return;
  }
  topic = topic.split('/').slice(2).join('/');

  if(Data.mqtt_data[topic] === undefined){
    Data.mqtt_data[topic] = [];
  }
  Data.mqtt_data[topic].updated = Date.now();

  var found;
  data.updated = Date.now();
  for(var key in Data.mqtt_data[topic]){
    if(Data.mqtt_data[topic][key]._subject === data._subject){
      Data.mqtt_data[topic][key] = data;
      found = true;
      break;
    }
  }
  if(!found){
    Data.mqtt_data[topic].push(data);
  }

  dataReceived(topic, data);
  Data.cleanOutOfDateMqtt(MQTT_CACHE_TIME);
};

Data.cleanOutOfDateMqtt = function(max_age){
  'use strict';
  max_age = max_age * 1000;  // ms to seconds.
  var pointer = Data.mqtt_data;
  var f = function(pointer, max_age){
    var loop_complete;
    while(!loop_complete){
      loop_complete = true;
      for(var key in pointer){
        if(pointer[key].updated && Math.abs(Date.now() - pointer[key].updated) > max_age){
          console.log('Removing:', key, typeof(pointer[key]));
          if(Array.isArray(pointer)){
            pointer.splice(key, 1);
          } else {
            delete pointer[key];
          }
          // Since we have removed a property, we can no longer trust the for loop is sane.
          loop_complete = undefined;
          break;
        } else if(pointer[key].updated !== undefined) {
          f(pointer[key], max_age);
        }
      }
    }
  };
  f(pointer, max_age);
};

Data.getLabels = function(){
  'use strict';
  var labels_object = {};
  var label;
  for(var topic in Data.mqtt_data){
    for(var subject in Data.mqtt_data[topic]){
      for(label in Data.mqtt_data[topic][subject]){
        if(label[0] === '_'){
          labels_object[label] = true;
        }
      }
    }
  }
  var label_list = [];
  for(label in labels_object){
    label_list.push(label);
  }
  return label_list;
};

var Mqtt = {};
Mqtt.reconnectTimeout = 2000;
Mqtt.regex_topic = /^(\w+\/?)+$/ ;

Mqtt.MQTTconnect = function() {
  'use strict';
  Mqtt.broker = new Messaging.Client( BROKER_ADDRESS, BROKER_PORT, "web_" + parseInt(Math.random() * 100, 10));
  var options = {
      timeout: 3,
      useSSL: USE_TLS,
      cleanSession: CLEANSESSION,
      onSuccess: Mqtt.onConnect,
      onFailure: function (message) {
                 console.log("Connection failed: " + message.errorMessage + "Retrying");
                 setTimeout(Mqtt.MQTTconnect, Mqtt.reconnectTimeout);
      }
  };

  Mqtt.broker.onConnectionLost = Mqtt.onConnectionLost;
  Mqtt.broker.onMessageArrived = Mqtt.onMessageArrived;

  if (username !== null) {
    options.userName = username;
    options.password = password;
  }
  console.log("Host="+ BROKER_ADDRESS + ", port=" + BROKER_PORT + " TLS = " + USE_TLS + " username=" + username + " password=" + password);
  Mqtt.broker.connect(options);
};

Mqtt.onConnect = function() {
  'use strict';
  console.log('Connected to ' + BROKER_ADDRESS + ':' + BROKER_PORT);
  Mqtt.broker.subscribe(ANNOUNCE_SUBSCRIPTION, {qos: 0});
  console.log('Subscribed: ' + ANNOUNCE_SUBSCRIPTION);

  Mqtt.send(Page.topics.all_devices, '_command : solicit');
  console.log('Sent: ' + Page.topics.all_devices + ' = {_command : solicit}');
};

Mqtt.onConnectionLost = function(response) {
  'use strict';
  setTimeout(Mqtt.MQTTconnect, Mqtt.reconnectTimeout);
  console.log("connection lost: " + response.errorMessage + ". Reconnecting");
};

Mqtt.onMessageArrived = function(message) {
  'use strict';
  // Make sure topic looks like valid MQTT addresses.
  var topic;
  if (message.destinationName.match(Mqtt.regex_topic)) {
    topic = Mqtt.regex_topic.exec(message.destinationName)[0];
  }
  if (!topic) {
    console.log('Mqtt.onMessageArrived: Malformed topic: ' + message.destinationName);
    return;
  }

  var data_object = Mqtt.data_to_object(message.payloadString);
  if (typeof data_object !== 'object') {
    try {
      // Try and see if it's JSON encoded:
      data_object = JSON.parse(message.payloadString);
    }
    catch (e) { 
      console.log('Mqtt.onMessageArrived: Illegal charicter in payload: ' + message.payloadString);
      return;
    }
  }

  console.log(topic + ' = ', data_object);
  Data.storeIncomingMqtt(topic, data_object);
};

Mqtt.data_to_object = function(data) {
  'use strict';
  // data should be a list of key:value pairs, separated by a colon (:).
  // eg the following is valid:
  //    _subject : users/104167545338599232229, _count : 1, _display_name : Duncan Law
  // Ideally there will be a _subject key and the value should be a valid topic fragment.
  // If no _subject is set, we can presume the packet applies to the address of the topic.
  var regex_data = /^s*([\s\w\/:,._]+)s*$/ ;
  if (data.match(regex_data)) {
    data = regex_data.exec(data)[0];
  } else {
    return;
  }
  data = data.replace(/:/g, ' : ');
  data = data.replace(/,/g, ' , ');
  data = data.split(' ');

  var data_object = {};
  var key_or_val;
  for(var index in data){

    if (data[index] === ''){
      // pass.
    } else if(!key_or_val){
      if (data[index][0] !== '_') {
        console.log('Mqtt.onMessageArrived: Incorrectly formed key: ' + data[index] + '. Expected to start with "_".');
        return;
      }
      key_or_val = data[index];
    } else if (data[index] === ':') {
      // pass.
    } else if (data[index] === ','){
      // Next key:value pair.
      key_or_val = undefined;
    } else if (!data_object[key_or_val]) {
      data_object[key_or_val] = data[index];
    } else {
      // Append data.
      data_object[key_or_val] += ' ' + data[index];
    }
  }

  // The "_subject" in data_object refers to the target that this MQTT packet is about and
  // should also look like a topic.
  if (!data_object._subject.match(Mqtt.regex_topic)) {
    console.log('Mqtt.onMessageArrived: Malformed _subject: ' + data_object._subject);
    return;
  }

  return data_object;
};

Mqtt.send = function(send_topic, data) {
  'use strict';
  var message = new Messaging.Message(data);
  message.destinationName = send_topic;
  message.qos = 0;
  Mqtt.broker.send(message);
};

/* Takes a list of topics and returns combinations that include likely wildcards. */
function ExpandTopicsObject(input_topics){
  'use strict';
  var topic_object = {};

  for(var topic_index in input_topics){
    var topic = input_topics[topic_index];
    var topic_atoms = topic.split('/');
    var role = topic_atoms[0];
    topic_atoms = topic_atoms.slice(1);
    if(topic_atoms.length === 0){
      topic_atoms = ['_'];
    }

    if(topic_object[role] === undefined){
      topic_object[role] = {};
    }
    if(topic_object['+'] === undefined){
      topic_object['+'] = {};
    }

    var pointer_role = topic_object[role];
    var pointer_all = topic_object['+'];
    for(var i in topic_atoms){
      if(pointer_role[topic_atoms[i]] === undefined && topic_atoms[i] !== '_'){
        pointer_role[topic_atoms[i]] = {};
      }
      if(pointer_all[topic_atoms[i]] === undefined && topic_atoms[i] !== '_'){
        pointer_all[topic_atoms[i]] = {};
      }
      pointer_role['#'] = {};
      pointer_all['#'] = {};
      pointer_role = pointer_role[topic_atoms[i]];
      pointer_all = pointer_all[topic_atoms[i]];
    }

  }
  topic_object['#'] = {};
  return topic_object;
}

function ExpandTopicsList(topic_object){
  'use strict';
  if(Array.isArray(topic_object)){
    topic_object = ExpandTopicsObject(topic_object);
    console.log(topic_object);
  }

  var topic_list = [];
  for(var key in topic_object){
    var child_list = Data.ExpandTopics(topic_object[key]);
    if(child_list.length){
      for(var index in child_list){
        var new_list = [key];
        new_list = new_list.concat(child_list[index]);
        topic_list.push(new_list);
      }
    } else {
      topic_list.push([key]);
    }
  }
  return topic_list;
}

Data.ExpandTopics = function(topic_list){
  'use strict';
  topic_list = ExpandTopicsList(topic_list);
  var return_topic_list = [];
  for(var key in topic_list){
    return_topic_list.push(topic_list[key].join('/')); 
  }
  return return_topic_list;
};


Data.GetMatchingTopics = function(topic){
  'use strict';
  var topic_atoms = topic.split('/');
  var matches = [];
  for(var key in this.mqtt_data){
    var cached_topic_atoms = key.split('/');
    var match = true;
    for(var index in cached_topic_atoms){
      if(index >= topic_atoms.length){
        match = false;
        break;
      } else if(topic_atoms[index] === '#' && parseInt(index) +1 === topic_atoms.length){
        // Wildcard matches rest of topic.
        break;
      } else if(topic_atoms[index] !== '+' && topic_atoms[index] !== cached_topic_atoms[index]){
        match = false;
        break;
      }
    }
    if(match){
      matches.push(key);
    }
  }

  return matches;
};


var session_uid = function(){
  if(localStorage.getItem('session_uid')){
    return localStorage.getItem('session_uid');
  }
  var uid = '_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('session_uid', uid);
  return uid;
}


window.onload = function() {
  'use strict';
  Page.init();
  Page._intervalId_ = setInterval(Page.run, 1000 / Page.fps_);
  Mqtt.MQTTconnect();
  console.log("done window.onload");
};
