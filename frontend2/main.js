

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

  //Mqtt.send(Page.topics.all_devices, "command:solicit");
}

Mqtt.onConnectionLost = function(response) {
  setTimeout(Mqtt.MQTTconnect, Mqtt.reconnectTimeout);
  console.log("connection lost: " + response.errorMessage + ". Reconnecting");
};

Mqtt.onMessageArrived = function(message) {
  var topic = message.destinationName;

  // Make sure only valid characters are in payload with "match()".
  var regex = /^([\w/]+)\s*:\s*(\w+)\s*$/
  var regex_results = regex.exec(message.payloadString)

  console.log(topic + ' = ' + message.payloadString)
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
