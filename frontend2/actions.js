/*global FlowObjectMqttSubscribe*/
/*global FlowObjectMqttPublish*/
/*global FlowObjectReadFile*/
/*global FlowObjectAddTime*/
/*global FlowObjectCombineData*/
/*global FlowObjectAddData*/
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

var header_button_actions = {'mqtt-solicit': function(){Mqtt.send(Page.topics.all_devices, '_command : solicit');},

														 // TODO Allow us to force server to re-calculate everything. "homeautomation/0/control/_reload"
                             'clear-data': function(){Data.mqtt_data.debug = {};
                                                      Mqtt.send(Page.topics.all_devices, '_command : solicit');},
                             'log-selected': function(){console.log(getFlowObjectByUniqueId(shareBetweenShapes.selected) || getLink(shareBetweenShapes.selected));},
                             'log-links': function(){console.log(document.getElementsByTagName('ha-control')[0].links);}
                            };

var flow_objects = {FlowObjectMqttSubscribe: FlowObjectMqttSubscribe,
                    FlowObjectMqttPublish: FlowObjectMqttPublish,
                    FlowObjectReadFile: FlowObjectReadFile,
                    FlowObjectAddTime: FlowObjectAddTime,
                    FlowObjectCombineData: FlowObjectCombineData,
                    FlowObjectAddData: FlowObjectAddData,
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

  var index;
  for(index in flow_objects){
    if(index === received_data.object_type){
      var flow_object = getFlowObjectByUniqueId(received_data.unique_id);
      if(received_data.data === undefined){
        received_data.data = {};
      }
      if(received_data.version === undefined){
        received_data.version = 0;
      }
        
      if(flow_object && flow_object.data.version < received_data.version){
        console.log('Removing:', flow_object.data.unique_id, flow_object.data.version, received_data.version);
        flow_object.delete(false);
      }
      if(flow_object === undefined || flow_object.data.version < received_data.version){
        console.log('Adding...', received_data);
        flow_object = new flow_objects[index](ha_control.paper, ha_control.sidebar, undefined, received_data);
        console.log('Added');
      }

      flow_object.shape.setOutputLinks(flow_object.data.data.outputs);
    }
  }

	update_view();
 
  //console.log('dataReceived -');
};

