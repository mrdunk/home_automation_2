/*global FlowObjectMqttSubscribe*/
/*global FlowObjectMqttPublish*/
/*global FlowObjectReadFile*/
/*global FlowObjectAddTime*/
/*global FlowObjectCombineData*/
/*global FlowObjectModifyLabels*/
/*global FlowObjectSwitch*/

/*global shareBetweenShapes*/
/*global getFlowObjectByUniqueId*/
/*global getLink*/

/*global Mqtt*/
/*global Page*/
/*global Data*/

/*exported dataReceived*/
/*exported header_button_actions*/

var solicit_data = function(){
  console.log('solicit_data');
  Mqtt.send(Page.topics.all_devices, '_command : solicit'); 
}

var reset_data = function(){
  console.log('reset_data');
  Data.mqtt_data.announcments = {};
  Data.mqtt_data.debug = {};
}

var header_button_actions = {'mqtt-solicit': solicit_data,
														 // TODO Allow us to force server to re-calculate everything.
                             //   "homeautomation/0/control/_reload"
                             'clear-data': reset_data,
                             'log-selected': function(){console.log(getFlowObjectByUniqueId(shareBetweenShapes.selected) || getLink(shareBetweenShapes.selected));},
                             'log-links': function(){console.log(document.getElementsByTagName('ha-control')[0].links);}
                            };


var flow_objects = {FlowObjectMqttSubscribe: FlowObjectMqttSubscribe,
                    FlowObjectMqttPublish: FlowObjectMqttPublish,
                    FlowObjectReadFile: FlowObjectReadFile,
                    FlowObjectAddTime: FlowObjectAddTime,
                    FlowObjectCombineData: FlowObjectCombineData,
                    FlowObjectModifyLabels: FlowObjectModifyLabels,
                    FlowObjectSwitch: FlowObjectSwitch,
                    };


var update_view = function(){
  'use strict';
  // TODO Only need to update things if the data affects the currently selected object. 
  if(shareBetweenShapes.selected !== undefined){
    if(typeof(shareBetweenShapes.selected) === 'object' && shareBetweenShapes.selected.type === 'link' && document.getElementsByTagName('ha-link-content')[0]){
      document.getElementsByTagName('ha-link-content')[0].populate(shareBetweenShapes.selected);
    }else if(shareBetweenShapes.selected !== undefined){
      //selected_flow_object = getFlowObjectByUniqueId(shareBetweenShapes.selected);
      // TODO Update other objects when data comes in.
    }
  }
};

var dataReceived = function(topic, received_data){
  'use strict';
  console.log('dataReceived(', topic, received_data, ')');

  var ha_control = document.getElementsByTagName('ha-control')[0];

  var flow_object = getFlowObjectByUniqueId(received_data.unique_id);

  received_data.data = received_data.data || {};
  received_data.version = received_data.version || 0;

  if(flow_object && received_data.object_type === 'deleted'){
    console.log('Deleteing:', flow_object.data.unique_id);
    flow_object.delete();
    flow_object.deleteFromBackend();
  } else if(flow_object && flow_object.data.version < received_data.version){
    console.log('Replacing:', flow_object.data.unique_id, flow_object.data.version,
        received_data.version);
    flow_object.delete(false);
    flow_object = new flow_objects[received_data.object_type](ha_control.paper, ha_control.sidebar,
        undefined, received_data);
    flow_object.shape.setOutputLinks(flow_object.data.data.outputs);
  } else if(flow_object){
    console.log('Updating links:', flow_object.data.unique_id);
    flow_object.shape.setOutputLinks(flow_object.data.data.outputs);
  } else if(flow_object === undefined && received_data.shape){
    console.log('Adding:', received_data);
    flow_object = new flow_objects[received_data.object_type](ha_control.paper, ha_control.sidebar,
        undefined, received_data);
    flow_object.shape.setOutputLinks(flow_object.data.data.outputs);
  }

	update_view();
 
  //console.log('dataReceived -');
};

