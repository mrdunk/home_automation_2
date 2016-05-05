/*global Mqtt*/
/*global paper*/
/*global session_uid*/

/*global getPortShape*/

/*global PORT_WIDTH*/
/*global PORT_HEIGHT*/
/*global LINK_THICKNESS*/

/*exported flow_object_classes*/
/*exported getLinks*/

var SNAP = 10;

var shareBetweenShapes = {unique_id: 0};


/* Descend into object, returning child if it exists. */
var getPath = function(object, path) {
  'use strict';
  var parts = path.split('.');
  for(var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if(object[p] === undefined) {
      return;
    }
    object = object[p];
  }
  return object;
};

/* Descend into object, returning child if it exists and creating it if not */
var addPath = function(object, path) { 
  'use strict';
  var parts = path.split('.');
  for(var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if(object[p] === undefined) {
      object[p] = {};
    }
    object = object[p];
  }
  return object;
};


var getFlowObjectByUniqueId = function(unique_id){
  'use strict';
  return document.getElementsByTagName('ha-control')[0].flowObjects[unique_id];
};

var getFlowObjectByInstanceName = function(instance_name){
  'use strict';
  var flowObjects = document.getElementsByTagName('ha-control')[0].flowObjects;
  for(var index in flowObjects){
    if(flowObjects[index].data.data.general.instance_name.value === instance_name){
      return flowObjects[index];
    }
  }
  return;
};

var Link = function(link_data){
  'use strict';
  //console.log('Link(', link_data, ')');
  this.data = link_data;
  this.paper = document.getElementsByTagName('ha-control')[0].paper;
	this.sidebar = document.getElementsByTagName('ha-sidebar')[1];
};

Link.prototype.update = function(){
  'use strict';
  //console.log('Link.update()');
	var source_port_shape = getPortShape(this.data.source_object, this.data.source_port);
	var destination_port_shape = getPortShape(this.data.destination_object, this.data.destination_port);
  if(source_port_shape && destination_port_shape){
    if(this.shape){
		  this.shape.remove();
    }
    var source_port_position = source_port_shape.getShapePosition();
    var destination_port_position = destination_port_shape.getShapePosition();
    source_port_position.x += source_port_shape.getBBox().width;
    source_port_position.y += source_port_shape.getBBox().height / 2;
    destination_port_position.y += destination_port_shape.getBBox().height / 2;

    this.shape = this.paper.arrow(source_port_position, destination_port_position, 'teal');
    this.shape.data('type', 'link');
    this.shape.data('source_object', this.data.source_object);
    this.shape.data('source_port', this.data.source_port);
    this.shape.data('destination_object', this.data.destination_object);
    this.shape.data('destination_port', this.data.destination_port);
    this.shape.drag(function(){console.log('shape.drag.move');},
                    this.onDragStart,
                    function(){console.log('shape.drag.end');});
  }
};

Link.prototype.onDragStart = function(){
  'use strict';
  console.log('Link.onDragStart', this, this.getIdentity());
  var clicked_shape = this.getIdentity();
  var link_object = getLink(clicked_shape);

	link_object.displaySideBar();

  currentHighlightOff();
  shareBetweenShapes.selected = clicked_shape;
  currentHighlightOn();
};

/* Populate the sidebar with information about this link. */
Link.prototype.displaySideBar = function(){
  'use strict';
  var header_content = document.createElement('ha-link-header');
  header_content.populate(this.data);
  this.sidebar.setHeader(header_content);

  var flowobject_data = document.createElement('ha-link-content');
  flowobject_data.populate(this.data);
  this.sidebar.setContent(flowobject_data);
};

Link.prototype.delete = function(){
  'use strict';
  console.log('Link.delete(', this.data, ')');
  var source_object = getFlowObjectByUniqueId(this.data.source_object);
  if(source_object.data.data.outputs[this.data.source_port]){
    var remove_from_outputs = [];
    for(var output_link_index=0; output_link_index < source_object.data.data.outputs[this.data.source_port].links.length; output_link_index++){
      if(source_object.data.data.outputs[this.data.source_port].links[output_link_index].destination_object === this.data.destination_object &&
         source_object.data.data.outputs[this.data.source_port].links[output_link_index].destination_port === this.data.destination_port){
        remove_from_outputs.push(output_link_index);
      }
    }
    while(remove_from_outputs.length){
      source_object.data.data.outputs[this.data.source_port].links.splice(remove_from_outputs.pop(), 1);
    }
  }

  if(this.shape){
    this.shape.remove();
  }

  var all_links = document.getElementsByTagName('ha-control')[0].links;
  var remove_from_all_links = [];
  for(var i=0; i < all_links.length; i++){
    if(this.data.source_object === all_links[i].data.source_object && this.data.source_port === all_links[i].data.source_port &&
       this.data.destination_object === all_links[i].data.destination_object && this.data.destination_port === all_links[i].data.destination_port){
      //all_links.slice(i, 1);
      remove_from_all_links.push(i);
    }
  }
  while(remove_from_all_links.length){
    all_links.splice(remove_from_all_links, 1);
  }
};

/* Highlight which ever shape is currently selected according to the global "shareBetweenShapes.selected". */
function currentHighlightOn(){
  'use strict';
  if(typeof(shareBetweenShapes.selected) === 'object' && shareBetweenShapes.selected.type === 'link'){
    getLink(shareBetweenShapes.selected).shape.setHighlight(true, LINK_THICKNESS);
  } else if(shareBetweenShapes.selected !== undefined){
    getFlowObjectByUniqueId(shareBetweenShapes.selected).shape.setHighlight(true);
  }
}

/* Switch off highlight on which ever shape is currently selected according to the global "shareBetweenShapes.selected". */
function currentHighlightOff(){
  'use strict';
  if(typeof(shareBetweenShapes.selected) === 'object' && shareBetweenShapes.selected.type === 'link'){
    getLink(shareBetweenShapes.selected).shape.setHighlight('teal', LINK_THICKNESS);
  } else if(shareBetweenShapes.selected !== undefined){
    getFlowObjectByUniqueId(shareBetweenShapes.selected).shape.setHighlight(false);
  }
}

function getLink(link_data, create_link){
  'use strict';
  //console.log('getLink(', link_data, ')');
  var links = document.getElementsByTagName('ha-control')[0].links;
  for(var i = 0; i < links.length; i++){
		if(links[i].data.source_object === link_data.source_object &&
        links[i].data.source_port === link_data.source_port &&
        links[i].data.destination_object === link_data.destination_object &&
        links[i].data.destination_port === link_data.destination_port
				){
      return links[i];
    }
  }

  if(create_link !== false){
    console.log('getLink: new link');
    var link = new Link(link_data);
    link.update();
    links.push(link);
  }
}

var getLinks = function(link_data){
  'use strict';
	var links = document.getElementsByTagName('ha-control')[0].links;
	var return_links = [];

	for(var i = 0; i < links.length; i++){
    if((link_data.source_object === undefined || links[i].data.source_object === link_data.source_object) &&
       (link_data.source_port === undefined || links[i].data.source_port === link_data.source_port) &&
       (link_data.destination_object === undefined || links[i].data.destination_object === link_data.destination_object) &&
       (link_data.destination_port === undefined || links[i].data.destination_port === link_data.destination_port)){
      return_links.push(links[i]);
    }
  }
  return return_links;
};

var FlowObject = function(paper, sidebar){
  'use strict';
  //console.log('FlowObject', this);

  this.data = {data: {general: {object_type: { description: 'Object type', value: 'FlowObject' }}, outputs: {}, inputs: {}}};
  this.paper = paper;
  this.sidebar = sidebar;
};

FlowObject.prototype.updateLinks = function(){
  'use strict';
  //console.log('FlowObject.prototype.updateLinks');
  var links = document.getElementsByTagName('ha-control')[0].links;
  for(var i = 0; i < links.length; i++){
    if(links[i].data.source_object === this.data.unique_id || links[i].data.destination_object === this.data.unique_id){
      links[i].update();
    }
  }
};

FlowObject.prototype.setShape = function(shape){
  'use strict';
  this.shape = shape || paper.rect(0, 0, 30, 30, 5);
  this.shape.data('object_id', this.data.unique_id);
  this.shape.drag(this.onmove, this.onstart, this.onend);
  this.shape.mouseover(this.onmouseover);
  this.shape.mouseout(this.onmouseout);
  this.shape.mouseup(this.onmouseup);
  this.shape.setInputs(this);
  this.shape.setOutputs(this);
};

/* Return list of links to this object.
   Args:
    (string)port: Optional. If specified, only return the links to a specific input port.
*/
FlowObject.prototype.getInputLinks = function(port){
  'use strict';
  var return_list = [];
  var all_links = document.getElementsByTagName('ha-control')[0].links;
  for(var i = 0; i < all_links.length; i++){
    if(all_links[i].data.destination_object === this.data.unique_id){
      if(port === undefined || port === all_links[i].data.destination_port){
        return_list.push(all_links[i].data);
      }
    }
  }
  return return_list;
};

FlowObject.prototype.delete = function(removeLinks){
  'use strict';
  console.log('FlowObject.prototype.delete');

  if(shareBetweenShapes.selected === this.data.unique_id){
    shareBetweenShapes.selected = undefined;
  }
  this.shape.remove();
  
  if(removeLinks === undefined || removeLinks === true){
    for(var source_port_label in this.data.data.outputs){
      for(var link_source_index=0; link_source_index < this.data.data.outputs[source_port_label].links.length; link_source_index++){
        getLink(this.data.data.outputs[source_port_label].links[link_source_index]).delete();
      }
    }
    // Also need to remove from other end of link.
    var link_to_here = this.getInputLinks();
    for(var link_dest_index=0; link_dest_index < link_to_here.length; link_dest_index++){
      getLink(link_to_here[link_dest_index]).delete();
    }
  }

  delete document.getElementsByTagName('ha-control')[0].flowObjects[this.data.unique_id];
};

FlowObject.prototype.setInstanceName = function(instance_name){
  'use strict';
  console.log('FlowObject.setInstanceName(', instance_name, ')');
  instance_name = instance_name || 'Object_' + shareBetweenShapes.unique_id;
  var append_to_name = 1;
  var instance_name_base = instance_name;

  while(this.data.data.general.instance_name.value !== instance_name){
    if(getFlowObjectByInstanceName(instance_name) === undefined){
      this.data.data.general.instance_name.value = instance_name;
      break;
		}
    append_to_name++;
    instance_name = instance_name_base + '_' + append_to_name;
  }
  this.setContents(this.data);
};

FlowObject.prototype.setup = function(backend_data){
  'use strict';
  //console.log('FlowObject.setup(', backend_data, ')');

  if(backend_data.version === undefined){
    backend_data.version = 0;
  }
  if(backend_data.version){
    this.data.version = backend_data.version;
  }

  if(backend_data.unique_id){
    this.data.unique_id = backend_data.unique_id;
  } else {
    shareBetweenShapes.unique_id++;
    this.data.unique_id = this.constructor.name + '_' + shareBetweenShapes.unique_id + session_uid();
  }
  document.getElementsByTagName('ha-control')[0].flowObjects[this.data.unique_id] = this;

  if(getPath(backend_data, 'data.outputs') !== undefined){
    this.data.data.outputs = backend_data.data.outputs;
  }

  this.setInstanceName(getPath(backend_data, 'data.general.instance_name.value'));

  this.setShape(this.shape);
  if(getPath(backend_data, 'shape.position') !== undefined){
    this.setBoxPosition(backend_data.shape.position.x, backend_data.shape.position.y);
  }

  this.data.object_type = backend_data.object_type || this.constructor.name;

  // Make sure object is marked selected if it has been replaced.
  if(shareBetweenShapes.selected === this.data.unique_id){
    this.select();
  }
};

FlowObject.prototype.setContents = function(contents){
  'use strict';
  contents = contents || this.data;
  
  this.data.version = this.data.version || 0;
  this.shape.setContents(contents);
};

FlowObject.prototype.setInputs = function(){
  'use strict';
  this.shape.setInputs();
  this.shape.drag(this.onmove, this.onstart, this.onend);
};

FlowObject.prototype.setOutputs = function(){
  'use strict';
  this.shape.setOutputs();
  this.shape.drag(this.onmove, this.onstart, this.onend);
};

FlowObject.prototype.getBoxPosition = function(){
  'use strict';
  return this.shape[0].getBoxPosition();
};

FlowObject.prototype.setBoxPosition = function(x, y){
  'use strict';
  //console.log('FlowObject.setBoxPosition(', x, y, ')');
  if(typeof(x) === 'object' && y === undefined){
    // Has been passed a position object: {x: X_coord, y: Y_coord}.
    y = x.y;
    x = x.x;
  }
  this.shape[0].setBoxPosition(x, y);
};

FlowObject.prototype.select = function(){
  'use strict';
  //console.log('FlowObject.select:', this);

  currentHighlightOff();
  shareBetweenShapes.selected = this.data.unique_id;
  currentHighlightOn();

  this.displaySideBar();
};

FlowObject.prototype.displaySideBar = function(){
  'use strict';
  //console.log('FlowObject.displaySideBar()');

  var header_content = document.createElement('ha-flowobject-header');
  header_content.populate(this.data, this);
  this.sidebar.setHeader(header_content);

  // Content
  var flowobject_data = document.createElement('ha-flowobject-data');
  flowobject_data.populate(this.data.data, this);
  this.sidebar.setContent(flowobject_data);
};

FlowObject.prototype.onmouseover = function(){
  'use strict';
  if(shareBetweenShapes.dragging){
    var clicked_shape = this.getIdentity();
    if(clicked_shape.type === 'input'){
      shareBetweenShapes.linked = {source_object: shareBetweenShapes.dragging.source_object, source_port: shareBetweenShapes.dragging.source_port,
                                   destination_object: clicked_shape.object_id, destination_port: clicked_shape.port_label};
      this.animate({"fill-opacity": 0.2}, 500);
    }
  }
};

FlowObject.prototype.onmouseout = function(){
  'use strict';
  var clicked_shape = this.getIdentity();
  if(shareBetweenShapes.dragging && clicked_shape.object_id !== shareBetweenShapes.dragging.source_object){
    this.animate({"fill-opacity": 1}, 500);

    delete shareBetweenShapes.linked;
  }
};

FlowObject.prototype.onmouseup = function(){
  'use strict';
  this.animate({"fill-opacity": 1}, 500);
};

FlowObject.prototype.onmove = function(dx, dy){
  'use strict';
  //console.log('FlowObject.onmove(', dx, dy, ')');

  if(!this.timer){
    var type = this.data('type');
    var shape = this;
    var startx = this.start_move_x;
    var starty = this.start_move_y;
    this.timer = setTimeout(function(){do_periodically(type, startx, starty, dx, dy, shape);}, 40);
  }

  function do_periodically(type, startx, starty, dx, dy, shape){
    //console.log('do_periodically(', type, startx, starty, dx, dy, shape, ')');
    if(type=== 'parent' || type === 'body'){
      shape.setBoxPosition(startx + dx, starty + dy);
    } else if(shareBetweenShapes.dragging) {
      var path = shareBetweenShapes.dragging.arrow.attr('path');
      var pos2 = {x: path[0][1] + dx, y: path[0][2] + dy};
      shareBetweenShapes.dragging.arrow.dragArrow(pos2);
    }
    shape.timer = undefined;
  }
};

// TODO: move out of FlowObject name-space.
FlowObject.prototype.onstart = function(){
  'use strict';
  console.log('FlowObject.onstart()', this);
  
  var clicked_shape = this.getIdentity();
  var object = getFlowObjectByUniqueId(clicked_shape.object_id);

  object.select();
  this.animate({"fill-opacity": 0.2}, 500);

  if(clicked_shape.type === 'parent' || clicked_shape.type === 'body'){
    this.start_move_x = this.attr("x");
    this.start_move_y = this.attr("y");
  } else if(clicked_shape.type === 'input'){
  } else if(clicked_shape.type === 'output'){
    var pos1 = this.getShapePosition();
    pos1.x = pos1.x + PORT_WIDTH;
    pos1.y = pos1.y + PORT_HEIGHT /2;
    var pos2 = {x: pos1.x + 5, y: pos1.y};
    shareBetweenShapes.dragging = {arrow: this.paper.arrow(pos1, pos2, 'red'), source_object: clicked_shape.object_id, source_port: clicked_shape.port_label};
    shareBetweenShapes.dragging.arrow.node.setAttribute("pointer-events", "none");
  }
};

FlowObject.prototype.onend = function(){
  'use strict';
  //console.log('FlowObject.onend()');
  this.animate({"fill-opacity": 1}, 500);
  
  var clicked_shape = this.getIdentity();
  var object = getFlowObjectByUniqueId(clicked_shape.object_id);

  if(shareBetweenShapes.dragging && shareBetweenShapes.dragging.arrow){
    shareBetweenShapes.dragging.arrow.remove();  
    delete shareBetweenShapes.dragging;

    if(shareBetweenShapes.linked){
      console.log(shareBetweenShapes.linked);
      object.linkOutToIn(shareBetweenShapes.linked);
      delete shareBetweenShapes.linked;
    }
  } else {
    // Finished dragging FlowObject.
    if(this.timer){
      window.clearTimeout(this.timer);
      this.timer = undefined;
    }
    var position = object.getBoxPosition();
    position.x += SNAP /2 - position.x % SNAP;
    position.y += SNAP /2 - position.y % SNAP;
    object.setBoxPosition(position);
    object.ExportObject();
  }
};

FlowObject.prototype.linkOutToIn = function(link_data){
  'use strict';
  console.log('FlowObject.linkOutToIn(', link_data, ')');

  var source_port = link_data.source_port;
  var destination_object = link_data.destination_object;
  var destination_port = link_data.destination_port;

  if(!source_port || !destination_object || !destination_port){
    return;
  }

  console.log(this.data.data.outputs);
  for(var port_id in this.data.data.outputs){
    if(port_id === source_port){
      if(this.data.data.outputs[port_id].links === undefined){
        this.data.data.outputs[port_id].links = [];
      }
      var source_port_links = this.data.data.outputs[port_id].links;
      var found = false;
      for(var i = 0; i < source_port_links.length; i++){
        if(source_port_links[i].source_port === source_port &&
            source_port_links[i].destination_object === destination_object &&
            source_port_links[i].destination_port === destination_port){
          // Already has this link.
          found = true;
          break;
        }
      }
      if(!found){
        console.log('LINK!');
        source_port_links.push({type: 'link', source_object: this.data.unique_id, source_port: source_port, destination_object: destination_object, destination_port: destination_port});
        this.ExportObject();
      }
      break;
    }
  }

  this.shape.setOutputLinks(this.data.data.outputs);
};


FlowObject.prototype.setRadius = function(radius){
  'use strict';
  this.shape.attr({'r': radius});
};

FlowObject.prototype.setColor = function(color){
  'use strict';
  this.shape.attr("fill", color);
  this.shape.attr("stroke", "#000");
};

FlowObject.prototype.getColor = function(){
  'use strict';
  return this.shape[0].attr("fill");
};

FlowObject.prototype.ExportObject = function(){
  'use strict';
  this.data.version += 1;

  var stripedVersion = function(obj){
    if (obj === null || typeof obj !== 'object') {
      return;
    }
    var temp = {};
    for (var attr in obj) {
      if(attr === 'value' || attr === 'values' || attr === 'shape' || attr === 'unique_id' || attr === 'version' ||
          attr === 'links' || attr === 'object_type' || attr === 'outputs'){
        temp[attr] = obj[attr];
      } else {
        var temp2 = stripedVersion(obj[attr]);
        if(temp2 !== undefined){
          temp[attr] = stripedVersion(obj[attr]);
        }
      }
    }
    return temp;
  };

  // The luci.json used on the backend interprets an empty object as an array.
  // Here we put a temporary tag into all empty objects.
  var MakeSafeForJson = function(to_convert){
    if(typeof to_convert === 'object'){
      if(Array.isArray(to_convert)){
        //console.log('array');
      } else {
        //console.log('object');
        var empty_object = true;
        var found_tag = false;
        for(var index in to_convert){
          if(index === '___force_json_object'){
            found_tag = true;
          } else {
            empty_object = false;
          }
          MakeSafeForJson(to_convert[index]);
        }
        if(found_tag && !empty_object){
          to_convert.___force_json_object = undefined;
        }
        if(empty_object){
          to_convert.___force_json_object = true;
        }
      }
    }
  };

  var stripped_object = stripedVersion(this.data);
  stripped_object.shape.position = this.shape.getShapePosition();
  MakeSafeForJson(stripped_object);
  console.log(JSON.stringify(stripped_object));
  Mqtt.send('homeautomation/0/control/_announce', JSON.stringify(stripped_object));
};



// Must be used *before* re-defining any class methods.
var inheritsFrom = function (child, parent) {
  'use strict';
  child.prototype = Object.create(parent.prototype);
  child.prototype.$super = parent.prototype;
  child.prototype.constructor = child;
};


var flow_object_classes = [FlowObjectMqttSubscribe, FlowObjectMqttPublish, FlowObjectReadFile, FlowObjectAddTime, FlowObjectCombineData, FlowObjectAddData, FlowObjectModifyLabels, FlowObjectSwitch];


function FlowObjectMqttSubscribe(paper, sidebar, shape, backend_data){
  'use strict';
  console.log("FlowObjectMqttSubscribe");

  FlowObject.prototype.constructor.call(this, paper, sidebar);

  this.data = { class_label: 'MQTT Subscription',
                class_description: 'Monitor MQTT for a specific topic.',
                shape: {
                  width: 100,
                  height: 50,
                  color: 'seagreen',
                },
                data: {
                  general: {
                    instance_name: { 
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      update_on_change: this.setInstanceName,
                      //value: 'Object_' + shareBetweenShapes.unique_id
                    }
                  },
                  inputs: {
                    subscription: {
                      description: 'MQTT subscription',
                      hidden: true,
                      subscribed_topic: {
                        description: 'MQTT topic',
	                      updater: 'ha-topic-chooser',
  	                    value: '#'
                    	},
                    }
                  },
                  outputs: {
                    default_out: {
                      ttl: {
                        description: 'Time to live (seconds)',
                        updater: 'ha-general-attribute',
                        form_type: 'number',
                        value: 60*60
                      },
                    }
                  }
								}
              };

  if(paper){
    this.shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, this.data.shape.color);
    this.setup(backend_data);

    if(getPath(backend_data, 'data.inputs.subscription.subscribed_topic') !== undefined){
      this.data.data.inputs.subscription.subscribed_topic.value = backend_data.data.inputs.subscription.subscribed_topic.value;
      this.setContents();
    }
  }
}

inheritsFrom(FlowObjectMqttSubscribe, FlowObject);

FlowObjectMqttSubscribe.prototype.setContents = function(contents){
  'use strict';
  console.log('FlowObjectMqttSubscribe.setContents(', contents, ')');
	
  //this.$super.setContents.call(this, contents);
  FlowObject.prototype.setContents.call(this, contents);

  console.log('FlowObjectMqttSubscribe.setContents -');
};

FlowObjectMqttSubscribe.prototype.ExportObject = function(){
  'use strict';
  // TODO need to modify subscribed_topic before we call this.$super.ExportObject()
  //var send_object = this.$super.ExportObject.call(this, send_object);
  var send_object = FlowObject.prototype.ExportObject.call(this, send_object);

  //send_object.data.general.subscribed_topic = this.data.data.general.subscribed_topic.value;
  //send_object.data.general.subscribed_topic.replace('homeautomation/+/', '');
};



function FlowObjectMqttPublish(paper, sidebar, shape, backend_data){
  'use strict';
  console.log("FlowObjectMqttPublish");

  FlowObject.prototype.constructor.call(this, paper, sidebar);
  this.data = { class_label: 'MQTT Publish',
                class_description: 'Publish MQTT a message for a specific topic.',
                shape: {
                  width: 100,
                  height: 50,
                  color: 'seagreen',
                },
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      update_on_change: this.setInstanceName,
                      //value: 'Object_' + shareBetweenShapes.unique_id
                      },
                    //publish_topic: {
                    //  description: 'MQTT topic to Publish to',
                    //  updater: 'ha-general-attribute',
                    //  value: 'homeautomation/test' },
                    payload_passthrough: {
                      description: 'Use Input payload as Output.',
                      updater: 'ha-general-attribute',
                      value: true },
                    payload_custom: {
                      description: 'Custom string to send as payload.',
                      updater: 'ha-general-attribute',
                      value: '42' },
                    },
                  inputs: {
                    default_in: {
                      description: 'Publish',
                      //port_label: 'default_in',
                      value: 'publish'
                    }
                  },
                  outputs: {
                    publish: {
                      description: 'MQTT Publish',
                      hidden: true,
                      publish_topic: {
                        description: 'MQTT topic to Publish to',
                        updater: 'ha-general-attribute',
                        value: 'homeautomation/test'
                      },
                    }
                  }
								}
              };
  if(paper){
    this.shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, this.data.shape.color);
    this.setup(backend_data);

    if(getPath(backend_data, 'data.outputs.publish.publish_topic') !== undefined){
      this.data.data.outputs.publish.publish_topic.value = backend_data.data.outputs.publish.publish_topic.value || this.data.data.outputs.publish.publish_topic.value;
      this.setContents();
    }
  }
}

inheritsFrom(FlowObjectMqttPublish, FlowObject);


function FlowObjectSwitch(paper, sidebar, shape, backend_data){
  'use strict';
  console.log("FlowObjectSwitch(", backend_data, ')');

  FlowObject.prototype.constructor.call(this, paper, sidebar);
  this.data = { class_label: 'Switch',
                class_description: 'Switch between outputs based on a value.',
                shape: {
                  width: 60,
                  height: 50,
                  color: 'crimson',
                },
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      update_on_change: this.setInstanceName,
                      //value: 'Object_' + shareBetweenShapes.unique_id
                    },
                    output_count: {
                      description: 'Number of outputs',
                      updater: 'ha-general-attribute',
                      form_type: 'number',
                      update_on_change: this.updateOutputCount,
                      value: 1
                    }
                  },
                  inputs: {
                    default_in: {
                      description: 'Input 1',
                      stop_after_match: {
                        description: 'Stop after first match',
                        updater: 'ha-general-attribute',
                        value: true,
                        form_type: 'checkbox'
                      },
                      transitions: {
                          description: 'Map Input ranges to desired Output.',
                          updater: 'ha-switch-rules',
                          filter_on_label: {
                            description: 'Label',
                            value: '_subject',
                          },
                          values: {
                            rules: [{if_type: 'bool',
                                     if_value: true,
                                     send_to: 'branch_1'}],
                            otherwise: {send_to: '_drop'}
                          }
                      },
                    },
                  },
                  outputs: {
							      branch_1: {},
                    _drop: {hidden: true},
                    _error: {hidden: true}
                  }}};
  if(paper){
    this.shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, this.data.shape.color);
    this.setup(backend_data);
    this.updateSwitch(backend_data);
  }
}

inheritsFrom(FlowObjectSwitch, FlowObject);

FlowObjectSwitch.prototype.updateOutputCount = function(new_count){
  "use strict";
  if(new_count < 1){
    new_count = 1;
  }
  this.data.data.general.output_count.value = new_count;
  var remove_these = [];
  var max_found = 0;
  for(var output in this.data.data.outputs){
    if(this.data.data.outputs.hasOwnProperty(output) && output.split('_')[0] === 'branch'){
      if(parseInt(output.split('_')[1]) > this.data.data.general.output_count.value){
        remove_these.push(output);
      } else if(parseInt(output.split('_')[1]) > max_found) {
        max_found = parseInt(output.split('_')[1]);
      }
    }
  }
  var remove = remove_these.pop();
  while(remove){
    console.log(this.data.data.outputs[remove]);
    for(var link_index=0; link_index < this.data.data.outputs[remove].links.length; link_index++){
      var link = getLink(this.data.data.outputs[remove].links[link_index]);
      console.log(link);
      // TODO: delete link from list.
    }
    delete this.data.data.outputs[remove];
    remove = remove_these.pop();
  }

  for(var i=max_found +1; i <= this.data.data.general.output_count.value; i++){
    this.data.data.outputs['branch_' + i] = {};
  }

  this.setShape(this.shape);
};

FlowObjectSwitch.prototype.updateSwitch = function(backend_data){
  "use strict";
  console.log('FlowObjectSwitch.updateSwitch(', JSON.stringify(backend_data), ')');
  if(getPath(backend_data, 'data.inputs.default_in.stop_after_match.value') !== undefined){
    addPath(this.data.data, 'inputs.default_in.stop_after_match.value');
    this.data.data.inputs.default_in.stop_after_match.value = backend_data.data.inputs.default_in.stop_after_match.value;
  }
  if(getPath(backend_data, 'data.inputs.default_in.transitions.filter_on_label.value') !== undefined){
    addPath(this.data.data, 'inputs.default_in.transitions.filter_on_label.value');
    this.data.data.inputs.default_in.transitions.filter_on_label.value = backend_data.data.inputs.default_in.transitions.filter_on_label.value;
  }
  if(getPath(backend_data, 'data.inputs.default_in.transitions.values.rules') !== undefined){
    addPath(this.data.data, 'inputs.default_in.transitions.values');
    this.data.data.inputs.default_in.transitions.values.rules = [];
    // We cannot presume the list of rules is in the correct order so we must look them up by the rule's "rule_number" parameter.
    var get_rule = function(number){
      for(var i=0; i < backend_data.data.inputs.default_in.transitions.values.rules.length; i++){
        if(backend_data.data.inputs.default_in.transitions.values.rules[i].rule_number === number){
          return backend_data.data.inputs.default_in.transitions.values.rules[i];
        }
      }
    };
    for(var j=0; j < backend_data.data.inputs.default_in.transitions.values.rules.length; j++){
      this.data.data.inputs.default_in.transitions.values.rules.push(get_rule(j));
    }
  }
  if(getPath(backend_data, 'data.inputs.default_in.transitions.values.otherwise.send_to') !== undefined){
    addPath(this.data.data, 'inputs.default_in.transitions.values');
    this.data.data.inputs.default_in.transitions.values.otherwise = {send_to: backend_data.data.inputs.default_in.transitions.values.otherwise.send_to};
  }
};


function FlowObjectCombineData(paper, sidebar, shape, backend_data){
  'use strict';
  console.log('FlowObjectCombineData(', paper, sidebar, shape, backend_data, ')');

  FlowObject.prototype.constructor.call(this, paper, sidebar);
  this.data = { class_label: 'Combine data',
                class_description: 'Combine data sharing specified label from multiple data payloads.',
                shape: {
                  width: 100,
                  height: 50,
                  color: 'cornflowerblue',
                },
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      update_on_change: this.setInstanceName,
                      //value: 'Object_' + shareBetweenShapes.unique_id
                      }
                  },
                  inputs: {
                    default_in: {
                      description: 'Default input',
                      primary_key: {
                          description: 'Primary key.',
                          //updater: 'ha-select-label',
													updater: 'ha-general-attribute',
                          value: '' }
                      },
                    // TODO add reset.
                  },
                outputs: {
                    default_out: {}
                }
              }
	};
  if(paper){
    this.shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, this.data.shape.color);
    this.setup(backend_data);

    if(getPath(backend_data, 'data.inputs.default_in.primary_key') !== undefined){
      for(var input_label in this.data.data.inputs){
        this.data.data.inputs[input_label].primary_key.value = backend_data.data.inputs.default_in.primary_key.value;
      }
    }
  }
}

inheritsFrom(FlowObjectCombineData, FlowObject);



function FlowObjectAddData(paper, sidebar, shape, backend_data){
  'use strict';
  console.log('FlowObjectAddData(', paper, sidebar, shape, backend_data, ')');

  FlowObject.prototype.constructor.call(this, paper, sidebar);
  this.data = { class_label: 'Add data',
                class_description: 'Add data from multiple data payloads.',
                shape: {
                  width: 100,
                  height: 50,
                  color: 'cornflowerblue',
                },
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      update_on_change: this.setInstanceName,
                      //value: 'Object_' + shareBetweenShapes.unique_id
                      }
                  },
                  inputs: {
                    default_in: {
                      description: 'Default input',
                        primary_key: {
                          description: 'Primary key.',
                          updater: 'ha-select-label',
                          value: '' }
                        },
                    // TODO add reset.
                  },
                outputs: {
                    default_out: {}
                }
              }
	};
  if(paper){
    this.shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, this.data.shape.color);
    this.setup(backend_data);

    if(getPath(backend_data, 'data.inputs.default_in.primary_key_label') !== undefined){
      //for(var input_label in this.data.data.inputs){
        //this.data.data.inputs[input_label].primary_key.value = backend_data.data.inputs.default_in.primary_key_label
      //}
    }
  }
}

inheritsFrom(FlowObjectAddData, FlowObject);



function FlowObjectReadFile(paper, sidebar, shape, backend_data){
  'use strict';
  console.log('FlowObjectReadFile(', paper, sidebar, shape, backend_data, ')');

  FlowObject.prototype.constructor.call(this, paper, sidebar);
  this.data = { class_label: 'Read file',
                class_description: 'Read data from a file on disk.',
                shape: {
                  width: 100,
                  height: 50,
                  color: 'seagreen',
                },
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      update_on_change: this.setInstanceName,
                      //value: 'Object_' + shareBetweenShapes.unique_id
                      }
                  },
                  inputs: {
                    // TODO add trigger.
                    load_from_file: {
                      description: 'From file',
                      hidden: true,
                      filename: {
                        description: 'Filename',
                        updater: 'ha-general-attribute',
                        value: ''
                      },
										},
                  },
                outputs: {
                  default_out: {
                    ttl: {
                      description: 'Time to live (seconds)',
                      updater: 'ha-general-attribute',
                      form_type: 'number',
                      value: 60
                    },
                  }
                }
              }
	};
  if(paper){
    this.shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, this.data.shape.color);
    this.setup(backend_data);

    if(getPath(backend_data, 'data.inputs.load_from_file.filename.value') !== undefined){
      this.data.data.inputs.load_from_file.filename.value = backend_data.data.inputs.load_from_file.filename.value;
		}
  }
}

inheritsFrom(FlowObjectReadFile, FlowObject);


function FlowObjectAddTime(paper, sidebar, shape, backend_data){
  'use strict';
  console.log('FlowObjectAddTime(', paper, sidebar, shape, backend_data, ')');

  FlowObject.prototype.constructor.call(this, paper, sidebar);
  this.data = { class_label: 'Add time',
                class_description: 'Add time data to payload.',
                shape: {
                  width: 75,
                  height: 50,
                  color: 'gold',
                },
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      update_on_change: this.setInstanceName,
                      //value: 'Object_' + shareBetweenShapes.unique_id
                      }
                  },
                  inputs: {
                    default_in: {
                      description: 'Default input',
                      port_label: 'default_in',
                    },
                  },
                outputs: {
                    default_out: {}
                }
              }
	};
  if(paper){
    this.shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, this.data.shape.color);
    this.setup(backend_data);
  }
}

inheritsFrom(FlowObjectAddTime, FlowObject);



function FlowObjectModifyLabels(paper, sidebar, shape, backend_data){
  'use strict';
  console.log('FlowObjectModifyLabels(', paper, sidebar, shape, backend_data, ')');

  FlowObject.prototype.constructor.call(this, paper, sidebar);
  this.data = { class_label: 'Modify labels',
                class_description: 'Modify label names in data.',
                shape: {
                  width: 60,
                  height: 50,
                  color: 'crimson',
                },
                data: {
                  general: {
                    instance_name: {
                      description: 'Name',
                      updater: 'ha-general-attribute',
                      update_on_change: this.setInstanceName,
                      //value: 'Object_' + shareBetweenShapes.unique_id
                      }
                  },
                inputs: {
                  default_in: {
                    description: 'Default input',
                    port_label: 'default_in',

                    transitions: {
                          description: 'Rename labels.',
                          updater: 'ha-modify-labels-rules',
                          values: {
                            rules: []
                          }
                    },                    
                  },
                },
                outputs: {
                    default_out: {},
                    _error: {hidden: true}
                }
              }
  };
  if(paper){
    this.shape = shape || paper.box(0, 0, this.data.shape.width, this.data.shape.height, this.data.shape.color);
    this.setup(backend_data);
  }
}

inheritsFrom(FlowObjectModifyLabels, FlowObject);

