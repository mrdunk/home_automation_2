

var Page = {}

Page.init = function() {
  Page.running_ = true;
  Page.fps_ = 10;
  Page.topics = {};
  Page.topics.all_devices = 'homeautomation/0/all/all';
}

Page.run = function() {
}

Page.exit = function() {
  clearInterval(Page._intervalId_);
}

var Data = { mqtt_data: {} };

Data.storeIncomingMqtt = function(topic, label, data) {
  // Make sure topic and label both look like valid MQTT addresses.
  var regex = /^(\w+\/?)+$/ ;
  topic = regex.exec(topic)[0];
  label = regex.exec(label)[0];

  if(!topic){
    console.log('Incorrectly formed topic:', topic);
    return;
  }
  if(!label){
    console.log('Incorrectly formed label:', label);
    return;
  }

  var topic_atom_list = topic.split('/');
  var label_atom_list = label.split('/');

  if(topic === topic_atom_list.join('/') && topic_atom_list[0] === 'homeautomation' && label === label_atom_list.join('/')){
    if(topic_atom_list[2] === label_atom_list[0] && topic_atom_list[3] === 'announce'){
      // This is appears to be a valid announcement.
      var pointer = Data.mqtt_data;
      for(var i = 0; i < label_atom_list.length; i++){
        if(pointer[label_atom_list[i]] === undefined){
          pointer[label_atom_list[i]] = {};
          console.log('Adding:', label_atom_list[i]);
        }
        pointer = pointer[label_atom_list[i]];
        pointer.updated = Date.now();
        console.log('Updating:', label_atom_list[i]);
      }
    }
  }
  Data.cleanOutOfDateMqtt(MQTT_CACHE_TIME);
  console.log(Data.mqtt_data);
}

Data.cleanOutOfDateMqtt = function(max_age){
  max_age = max_age * 1000;  // ms to seconds.
  var pointer = Data.mqtt_data;
  var f = function(pointer, max_age){
    for(var key in pointer){
      if(pointer[key].updated && Math.abs(Date.now() - pointer[key].updated) > max_age){
        console.log('Removing:', key);
        delete pointer[key];
      } else {
        f(pointer[key], max_age);
      }
    }
  }
  f(pointer, max_age);
}

var Mqtt = {}
Mqtt.reconnectTimeout = 2000;

Mqtt.MQTTconnect = function() {
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

  if (username != null) {
    options.userName = username;
    options.password = password;
  }
  console.log("Host="+ BROKER_ADDRESS + ", port=" + BROKER_PORT + " TLS = " + USE_TLS + " username=" + username + " password=" + password);
  Mqtt.broker.connect(options);
}

Mqtt.onConnect = function() {
  console.log('Connected to ' + BROKER_ADDRESS + ':' + BROKER_PORT);
  Mqtt.broker.subscribe(ANNOUNCE_SUBSCRIPTION, {qos: 0});
  console.log('Subscribed to topic: ' + ANNOUNCE_SUBSCRIPTION);

  Mqtt.send(Page.topics.all_devices, "command:solicit");
}

Mqtt.onConnectionLost = function(response) {
  setTimeout(Mqtt.MQTTconnect, Mqtt.reconnectTimeout);
  console.log("connection lost: " + response.errorMessage + ". Reconnecting");
};

Mqtt.onMessageArrived = function(message) {
  var topic = message.destinationName;

  // Make sure only valid characters are in payload with "match()".
  var regex = /^([\w\/]+)\s*:\s*(\w+)\s*$/ ;
  var regex_results = regex.exec(message.payloadString);
  var label = regex_results[1];
  var data = regex_results[2];
  console.log(topic + ' = ' + regex_results[1] + " : " + regex_results[2]);

  Data.storeIncomingMqtt(topic, label, data);
};

Mqtt.send = function(send_topic, data) {
  message = new Messaging.Message(data);
  message.destinationName = send_topic;
  message.qos = 0;
  Mqtt.broker.send(message);
};


window.onload = function() {
  Page.init();
  Page._intervalId_ = setInterval(Page.run, 1000 / Page.fps_);
  Mqtt.MQTTconnect();
  console.log("done window.onload")
};
