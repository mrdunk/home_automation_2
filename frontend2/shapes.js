/*global Raphael*/

var PORT_HEIGHT = 15;
var PORT_WIDTH = 15;
var MIN_ARROW_LEN = 10;

var getPortShape = function(object_id, port_label){
  var object = getFlowObjectByUniqueId(object_id);
  if(object === undefined){ return; }

  for(var i = 0; i < object.shape.length; i++){
    if(object.shape[i].label === 'outputs' || object.shape[i].label === 'inputs'){
      for(var j = 0; j < object.shape[i].length; j++){
        if(object.shape[i][j].label === port_label){
          return object.shape[i][j];
        }
      }
    }
  }
}

var setBoxPosition = function(component, x, y){
  'use strict';
  if(component.type === "set"){
    for(var i = 0; i < component.items.length; i++){
      setBoxPosition(component.items[i], x, y);
    }
  } else {
    component.attr({x: x + component.x_offset, y: y + component.y_offset});
  }
};

Raphael.fn.arrow = function (pos1, pos2, color) {
  'use strict';
  if(Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y) < MIN_ARROW_LEN){
    pos2.x = pos1.x + MIN_ARROW_LEN;
  }
  var dx = Math.abs(pos2.x - pos1.x);
  if(dx > 100){
    dx = 100;
  }
  if(dx < 20){
    dx = 20;
  }

  //var path = 'M ' + pos1.x + ' ' + pos1.y + ' L ' + pos2.x + ' ' + pos2.y;
  var path = 'M ' + pos1.x + ' ' + pos1.y + ' C ' + (pos1.x + dx) + ' ' + pos1.y + ' ' + (pos2.x - dx) + ' ' + pos2.y + ' ' + pos2.x + ' ' + pos2.y;
  return this.path(path).attr({stroke: color, fill: "none", 'stroke-width': 3, 'arrow-end': 'classic-wide'});
};

Raphael.el.dragArrow = function(pos2) {
  var path = this.attr('path');
  var pos1 = {x: path[0][1], y: path[0][2]};
  if(path[1][0] === 'C'){
    path[1][5] = pos2.x;
    path[1][6] = pos2.y;
  } else if (path[1][0] === 'L'){
    if(Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y) >= MIN_ARROW_LEN){
      path[1][1] = pos2.x;
      path[1][2] = pos2.y;
    }
  }
  this.attr('path', path);
}


Raphael.fn.box = function(x, y, width, height, color){
  'use strict';
  var set_main = this.set();
  var shape = this.rect(x, y, width, height, 5);
  shape.label = 'container';  // TODO replace labels with .data()
  shape.data('type', 'body');
//	shape.data('object_id', this.data('object_id'));
  shape.x_offset = 0;
  shape.y_offset = 0;
  set_main.push(shape);

  var set_content = this.set();
  shape = this.text(x + 5, y, "Test Text").attr({font: "12px Fontin-Sans, Arial", fill: "#fff", "text-anchor": "start"});
  shape.x_offset = 5;
  shape.y_offset = 8;
  shape.node.setAttribute("pointer-events", "none");
  set_content.push(shape);
  set_content.label = 'contents';
  set_main.push(set_content);

  var set_inputs = this.set();
  set_inputs.label = 'inputs';
  set_main.push(set_inputs);

  var set_outputs = this.set();
  set_outputs.label = 'outputs';
  set_main.push(set_outputs);

  var set_links = this.set();
  set_links.label = 'links';
  set_main.push(set_links);

  set_main.data('whole_shape', set_main);

  set_main.attr({"fill": color, "stroke": "#000"});
  return set_main;
};

Raphael.st.setContents = function(content){
  'use strict';
  if(this.type === "set"){
    var pos = this.items[0].getBoxPosition();  // item 0 is the parent shape.
    var x = pos.x;
    var y = pos.y;
    for(var i = 0; i < this.items.length; i++){
      if(this.items[i].label === 'contents'){
        var node = this.items[i].pop();
        while(node){
          node.remove();
          node = this.items[i].pop();
        }
        var shape = this.paper.text(x + 5, y, content.object_name).attr({font: "12px Fontin-Sans, Arial", fill: "black", "text-anchor": "start"});
        shape.x_offset = 5;
        shape.y_offset = 8;
        shape.node.setAttribute("pointer-events", "none");
        this.items[i].push(shape);
        shape = this.paper.text(0, 0, content.data.general.instance_name.value).attr({font: "12px Fontin-Sans, Arial", fill: "black", "text-anchor": "start"});
        shape.x_offset = 5;
        shape.y_offset = 22;
        shape.node.setAttribute("pointer-events", "none");
        this.items[i].push(shape);
        // For some reason new shapes added to a set do not appear until they are moved.
        setBoxPosition(this.items[i], x, y);
      }
    }
  }
};

Raphael.st.setInputs = function(parent_context){
  'use strict';
  if(this.type === "set"){
    var pos = this.items[0].getBoxPosition();  // item 0 is the parent shape.
    var x = pos.x;
    var y = pos.y;
    var color = this.items[0].attr('fill');
    for(var i = 0; i < this.items.length; i++){
      if(this.items[i].label === 'inputs'){
        while(this.items[i].items.length){
          node = this.items[i].pop();
          node.remove();
        }
        var height_offset = 0;
        for(var data_key in parent_context.data.data.inputs){
          var port_label = parent_context.data.data.inputs[data_key].port_label;
          var object_id = parent_context.data.unique_id;
          var shape = this.paper.rect(x - PORT_WIDTH, y + PORT_HEIGHT + (i * PORT_HEIGHT), PORT_WIDTH, PORT_HEIGHT, 2);
          shape.data('port_label', port_label);
					shape.data('port_type', 'input');
          shape.data('object_id', object_id);
          shape.x_offset = -PORT_WIDTH;
          shape.y_offset = PORT_HEIGHT + (height_offset * PORT_HEIGHT);
          shape.attr({"fill": color, "stroke": "#000"});
          shape.label = port_label;
          
				  shape.mouseover(parent_context.onmouseover);
          shape.mouseout(parent_context.onmouseout);
          shape.mouseup(parent_context.onmouseup);

          this.items[i].push(shape);
          height_offset++;
        }
        // For some reason new shapes added to a set do not appear until they are moved.
        setBoxPosition(this.items[i], x, y);
      }
    }
  }
};

Raphael.st.setOutputs = function(parent_context){
  'use strict';
  if(this.type === "set"){
    var pos = this.items[0].getBoxPosition();  // item 0 is the parent shape.
    var x = pos.x;
    var y = pos.y;
    var width = this.items[0].attr('width');
    var color = this.items[0].attr('fill');
    for(var i = 0; i < this.items.length; i++){
      if(this.items[i].label === 'outputs'){
        while(this.items[i].items.length){
          node = this.items[i].pop();
          node.remove();
        }

        var height_offset = 0;
				for(var data_key in parent_context.data.data.outputs){
          var port_label = parent_context.data.data.outputs[data_key].port_label;
          var object_id = parent_context.data.unique_id;
          var shape = this.paper.rect(x - PORT_WIDTH, y + PORT_HEIGHT + (i * PORT_HEIGHT), PORT_WIDTH, PORT_HEIGHT, 2);
          shape.data('port_label', port_label);
          shape.data('port_type', 'output');
          shape.data('object_id', object_id);
          shape.x_offset = width;
          shape.y_offset = PORT_HEIGHT + (height_offset * PORT_HEIGHT);
          shape.attr({"fill": color, "stroke": "#000"});
          shape.label = port_label;
          
          shape.drag(parent_context.onmove, parent_context.onstart, parent_context.onend);
          shape.mouseover(parent_context.onmouseover);
          shape.mouseout(parent_context.onmouseout);
          shape.mouseup(parent_context.onmouseup);

          this.items[i].push(shape);
          height_offset++;
        }
        // For some reason new shapes added to a set do not appear until they are moved.
        setBoxPosition(this.items[i], x, y);
      }
    }
  }
};

/* Update link when the Output end is moved. */
Raphael.st.setOutputLinks = function(outputs){
  'use strict';
  var links, key_types;

  var this_identity = this.getIdentity();
  console.log(this_identity);

  for(key_types in this.items){
    if(this.items[key_types].label === 'links'){
      links = this.items[key_types];
      var node = links.pop();
      while(node){
        node.remove();
        node = links.pop();
      }
    }
  }

  for(var key_data_output in outputs){
    for(var key_link in outputs[key_data_output].links){
			var link_data = outputs[key_data_output].links[key_link];
      console.log(link_data);
			setLink({source_object: this_identity.object_id, source_port: link_data.source_port,
               destination_object: link_data.destination_object, destination_port: link_data.destination_port});
    }
  }
};

Raphael.st.getPort = function(type, index){
  'use strict';
  for(var key_types in this.items){
    if(this.items[key_types].label === type){
      for(var key_port = 0; key_port < this.items[key_types].length; key_port++){
        if(key_port === index){
          return this.items[key_types][key_port];
        } 
      } 
    }
  } 
};

Raphael.st.setHighlight = function(color, thickness){
  'use strict';
  for(var key_types in this.data('whole_shape').items){
    if(this.data('whole_shape').items[key_types].label === 'container'){
      this.data('whole_shape').items[key_types].setHighlight(color, thickness);
    }
  }
  for(var key_types in this.items){
    if(this.items[key_types].label === 'container'){
      this.items[key_types].setHighlight(color, thickness);
    }
  }
};

Raphael.el.setHighlight = function(color, thickness){
  'use strict';
  color = color || 'black';
  if(color === true){
    color = 'red';
    thickness = 3;
  }
  thickness = thickness || 1;

  for(var key_types in this.data('whole_shape').items){
    if(this.data('whole_shape').items[key_types].label === 'container'){
      this.data('whole_shape').items[key_types].attr({stroke: color, 'stroke-width': thickness});
    }
  }
};

Raphael.el.getBoxPosition = function(){
  'use strict';
  if(this.data('whole_shape') === undefined){
    return {x: 0, y: 0};
  }
  return {x: this.data('whole_shape')[0].attr("x"), y: this.data('whole_shape')[0].attr("y")};
};

Raphael.el.getShapePosition = function(){
  'use strict';
  return {x: this.attr("x"), y: this.attr("y")};
};

Raphael.el.setBoxPosition = function(x, y){
  'use strict';
  if(x !== undefined && y !== undefined){
    setBoxPosition(this.data('whole_shape'), x, y);
    setBoxPosition(this, x, y);
  }

  var object = getFlowObjectByUniqueId(this.getIdentity().object_id);
  object.updateLinks();
};

Raphael.st.getShapePosition = function(){
  'use strict';
  for(var i = 0; i < this.items.length; i++){
    if(this.items[i].getBoxPosition){
      return this.items[i].getBoxPosition();
    }
  }
};

Raphael.el.getIdentity = function(){
  'use strict';
  return {type:       (this.data('type') || this.data('port_type')),
          object_id:  this.data('object_id'),
          port_label: this.data('port_label')};
};

Raphael.st.getIdentity = function(){
  'use strict';
  return this[0].getIdentity();
};

