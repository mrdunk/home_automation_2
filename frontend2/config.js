var BROKER_ADDRESS='192.168.192.10';
var BROKER_PORT=18883;
var UI_SUBSCRIPTION='homeautomation/+/+/_announce';
//var UI_SUBSCRIPTION='homeautomation/+/+/#';

// When trying to build a list of all possible MQTT target addresses,
//which topics are likely to contain _subject labels which are also target addresses?
var SUBJECTS_ARE_TARGETS=['lighting/_announce'];

var USE_TLS=false;
var CLEANSESSION=true;
var username=null;
var password=null;

var MQTT_CACHE_TIME = 60*60*24;  // seconds
//var MQTT_CACHE_TIME = 10;
