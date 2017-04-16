

var Page = {}

Page.init = function() {
  Page.running_ = true;
  Page.fps_ = 10;
  Page.log_ = document.getElementById("ha-container-log").getElementsByClassName("ha-container-children")[0];
  Page.log_.className = Page.log_.className + " ha-container-log-content"
  Page.topics = {};
  Page.topics.all_devices = 'homeautomation/0/_all/_all';
}

Page.run = function() {
}

Page.exit = function() {
  clearInterval(Page._intervalId_);
}

Page.AppendToLog = function(new_content, color) {
  var li = document.createElement("li");
  li.appendChild(document.createTextNode(new_content));
  Page.log_.appendChild(li)
  if(color){
    li.style.color = color;
  }
}


var Mqtt = {}
Mqtt.reconnectTimeout = 2000;

Mqtt.MQTTconnect = function() {
  Mqtt.broker = new Paho.MQTT.Client( BROKER_ADDRESS, BROKER_PORT, "web_" + parseInt(Math.random() * 100, 10));
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
  console.log("Host="+ BROKER_ADDRESS + ", port=" + BROKER_PORT +
      " TLS = " + USE_TLS + " username=" + username + " password=" + password);
  Mqtt.broker.connect(options);
}

Mqtt.onConnect = function() {
  console.log('Connected to ' + BROKER_ADDRESS + ':' + BROKER_PORT);
  Mqtt.broker.subscribe(STATE_SUBSCRIPTION, {qos: 1});
  console.log('Subscribed to topic: ' + STATE_SUBSCRIPTION);

  Page.AppendToLog(Page.topics.all_devices + " = _command:solicit", 'RED');
  var payload = {"_command" : "solicit",
                 "_subject" : Page.topics.all_devices};
  Mqtt.send(Page.topics.all_devices, payload);
}

Mqtt.onConnectionLost = function(response) {
  setTimeout(Mqtt.MQTTconnect, Mqtt.reconnectTimeout);
  console.log("connection lost: " + response.errorMessage + ". Reconnecting");
};

Mqtt.onMessageArrived = function(message) {
  // Make sure topic looks like valid MQTT addresses.
  var regex_topic = /^(\w+\/?)+$/ ;
  var topic;
  if (message.destinationName.match(regex_topic)) {
    topic = regex_topic.exec(message.destinationName)[0];
  }
  if (!topic) {
    console.log('Mqtt.onMessageArrived: Malformed topic: ' + message.destinationName);
    return;
  }

  var data_object = {};
  try{
    data_object = JSON.parse(message.payloadString);
  } catch(err) {
    console.log("WARNING: Invalid payload:");
    //console.log(err);
    console.log(message.payloadString);
  }

  // If "_subject" missing from data_object, presume it matches the topic.
  if(data_object._subject === undefined){
    data_object._subject = topic.split('/').slice(2).join('/');
  }

  // The "_subject" in data_object refers to the target that this MQTT packet is about and
  // should also look like a topic.
  if (!data_object._subject.match(regex_topic)) {
    console.log('Mqtt.onMessageArrived: Malformed _subject: ' + data_object._subject);
    return;
  }

  console.log(topic + ' = ', data_object);
  Page.AppendToLog(topic + ' = ' + JSON.stringify(data_object));

  if(data_object._subject && data_object._state){
    Page.AppendToLog('  payload parsed as: {_subject: ' + data_object._subject +
        ', _state: ' + data_object._state + '}', 'yellow');
    document.getElementById('ha-container-lighting').addChild(
        data_object._subject, data_object._state);
  }
};

Mqtt.ParsePayload = function(payload) {
  return_value = {};

  var key_counter = 0;

  var payload_array = payload.split(',');

  for (var i = 0; i < payload_array.length; i++) {
    var key, value;
    if(payload_array[i].split(':').length > 1) {
      // payload in the format "R: 123,G: 456,B: 789".
      key = payload_array[i].split(':')[0].trim();
      value = payload_array[i].split(':')[1].trim();
    } else {
      key = key_counter;
      key_counter++;
      value = payload_array[i].trim();
      if(value.split('#').length > 1){
        // '#89a' type hex format.
        value = '0x' + value.split('#')[1];
      } else if (value === 'on') {
        value = '0xff'
      } else if (value === 'off') {
        value = '0x00'
      }
    }
    if(value){
      return_value[key] = parseInt(value);
    }
  }

  return return_value;
}

Mqtt.send = function(send_topic, data) {
  var payload = JSON.stringify(data);
  if((send_topic.length + payload.length) > 124){
    console.log("WARNING: payload too long for esp8266 receive buffer. Trimming.");
    data._subject = undefined;
    payload = JSON.stringify(data);
  }
  message = new Paho.MQTT.Message(payload);
  message.destinationName = send_topic;
  message.qos = 1;
  Mqtt.broker.send(message);
};


window.onload = function() {
  Page.init();
  Page._intervalId_ = setInterval(Page.run, 1000 / Page.fps_);
  Mqtt.MQTTconnect();
  console.log("done window.onload")
};
