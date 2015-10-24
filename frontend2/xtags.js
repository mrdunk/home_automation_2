var PORT_SIZE = 10;

var objectTypes = {'alarm':          {'color':'blue', 'action':'new'},
                   'cloud-download': {'color':'red', 'action':'new', callback: function(paper, sidebar, sharedData, shape){FlowObjectMqttSubscribe(paper, sidebar, sharedData, shape);}},
                   'content-copy':   {'color':'green', 'action':'new'},
                   'redo':           {'action':'join'},
                   'settings':       {'action':'edit'}
                  }

xtag.register('ha-control', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-control').innerHTML;
      xtag.innerHTML(this, template);
      this.paper = Raphael('ha-control-paper', '100%', '100%');
      this.sidebar = document.getElementById('ha-control-sidebar');
      this.shapes = [];
      this.sharedData = {mode : 'default'};
    }
  },
  events: {
    'click:delegate(paper-icon-button)': function(mouseEvent){
      console.log(mouseEvent, this.icon)
      if(objectTypes[this.icon]){
        var ha_control;
        for (var i = 0; i < mouseEvent.path.length; i++){
          if(xtag.matchSelector(mouseEvent.path[i], 'ha-control')){
            ha_control = mouseEvent.path[i]
            break;
          }
        }
        if(ha_control === 'undefined'){ return; }

        var color = objectTypes[this.icon].color;
        var action = objectTypes[this.icon].action;
        if(color){
          ha_control.addShape(objectTypes[this.icon]);
        } else if(action === 'join'){
          console.log('join')
          if(this.hasAttribute('active')){
            ha_control.disableMenuAdd(true);
          } else {
            ha_control.disableMenuAdd(false);
          }
          
          // TESTING
          //ha_control.shapes[ha_control.shapes.length -1].replaceShape(ha_control.paper.box(0,0,50,50,3,2,'yellow'));
        } else if(action === 'edit'){
          console.log('edit')
          if(this.hasAttribute('active')){
            ha_control.disableMenuAdd(true);
            ha_control.sharedData.mode = 'edit';
          } else {
            ha_control.disableMenuAdd(false);
            ha_control.sharedData.mode = 'default';
          }
        }
      }
    },
  },
  methods: {
    addShape: function(object_type){
      var shape;
      console.log(object_type);
      if(object_type.callback){
        console.log(object_type.callback);
        shape = new FlowObjectMqttSubscribe(this.paper, this.sidebar, this.sharedData);
      } else {
        shape = new FlowObject(this.paper, this.sidebar, this.sharedData, this.paper.box(0, 0, 50, 50, 2, 3, object_type.color));
      }
      shape.setPosition(100,100);
      shape.displaySideBar();
      this.shapes.push(shape);
      if(this.shapes.length >= 2){
        this.paper.arrow(this.shapes[this.shapes.length -2], this.shapes[this.shapes.length -1], 'black');
      }
    },
    disableMenuAdd: function(state){
      console.log('disableMenuAdd(', state, ')');
      var buttons = xtag.queryChildren(xtag.queryChildren(this, 'div#ha-control-heading')[0], 'paper-icon-button');
      for(var i = 0; i < buttons.length; i++){
        if(objectTypes[buttons[i].icon].action === 'new'){
          if(state){
            buttons[i].setAttribute('disabled', state);
          } else {
             buttons[i].removeAttribute('disabled');
          }
        }
      }
    }
  }
});


var FlowObject = function(paper, sidebar, sharedData, shape){
  console.log('FlowObject');

  this.data = {object_name: 'FlowObject'};
  this.sidebar = sidebar;
  this.sharedData = sharedData;
  this.shape = shape || paper.rect(0, 0, 30, 30, 5);
  this.shape.data('parent', this);
  this.shape.drag(this.onmove, this.onstart, this.onend);
}

FlowObject.prototype.replaceShape = function(newShape){
  var pos = this.getPosition();
  this.shape.remove();
  this.shape = newShape;

  this.shape.drag(this.onmove, this.onstart, this.onend);
  this.setPosition(pos.x, pos.y);
}

FlowObject.prototype.setInputs = function(input_count){
  this.shape.setInputs(input_count);
  this.shape.drag(this.onmove, this.onstart, this.onend);
}

FlowObject.prototype.setOutputs = function(output_count){
  this.shape.setOutputs(output_count);
  this.shape.drag(this.onmove, this.onstart, this.onend);
}

FlowObject.prototype.getPosition = function(){
  return this.shape[0].getPosition();
}

FlowObject.prototype.setPosition = function(x, y){
  this.shape[0].setPosition(x, y);
}

FlowObject.prototype.displaySideBar = function(){
  console.log('FlowObject.displaySideBar()');

  // Header
  var header = this.sidebar.getElementsByClassName('sidebar-header')[0];
  if(this.data.instance_name === '' || this.data.instance_name === undefined){
    header.getElementsByClassName('text')[0].textContent = this.data.object_name;
    header.getElementsByClassName('object-color')[0].style.height = '1em';
  } else {
    header.getElementsByClassName('text')[0].innerHTML = this.data.object_name + '<br/>' + this.data.instance_name;
    header.getElementsByClassName('object-color')[0].style.height = '2em';
  }
  header.getElementsByClassName('object-color')[0].style.background = this.getColor();

  // Content

}

FlowObject.prototype.onmove = function(dx, dy){
  //console.log('FlowObject.onmove(', dx, dy, ')');

  if(this.data('parent').sharedData.mode === 'default'){
    if(this.id === this.data('myset')[0].id){
      this.setPosition(dx + this.start_move_x, dy + this.start_move_y);
    }
  } else if(this.data('parent').sharedData.mode === 'edit'){
  }
}

FlowObject.prototype.onstart = function(mouseEvent){
  console.log('FlowObject.onstart()', this, this.data('parent'));
  
  this.data('parent').displaySideBar();

  if(this.data('parent').sharedData.mode === 'default'){
    if(this.id === this.data('myset')[0].id){
      this.data('myset').forEach(function(component){
          // First component in set. (ie. the main container.)
          if(component.type === "rect"){
            component.start_move_x = component.attr("x");
            component.start_move_y = component.attr("y");
          }
      });

      this.data('myset').animate({"fill-opacity": .2}, 500);
    } else {
      this.animate({"fill-opacity": .2}, 500);
    }
  }
}

FlowObject.prototype.onend = function(){
  console.log('FlowObject.onend()');
  this.data('myset').animate({"fill-opacity": 1}, 500);
}

FlowObject.prototype.setRadius = function(radius){
  this.shape.attr({'r': radius});
}

FlowObject.prototype.setColor = function(color){
  this.shape.attr("fill", color);
  this.shape.attr("stroke", "#000");
}

FlowObject.prototype.getColor = function(){
  return this.shape[0].attr("fill");
}



var inheritsFrom = function (child, parent) {
    child.prototype = Object.create(parent.prototype);
};



var FlowObjectMqttSubscribe = function(paper, sidebar, sharedData, shape){
  console.log("FlowObjectMqttSubscribe");

  var shape = paper.box(0, 0, 150, 50, 2, 3, 'seagreen');

  FlowObject.prototype.constructor.call(this, paper, sidebar, sharedData, shape);
  this.data = { object_name: 'MQTT Subscription',
                instance_name: 'unset',
                description: 'Monitor MQTT for a specific topic.',
                value: ''};
  this.shape.setContents(this.data);
}

inheritsFrom(FlowObjectMqttSubscribe, FlowObject);




Raphael.fn.arrow = function (object1, object2, color) {
  var pos1 = object1.getPosition();
  var pos2 = object2.getPosition();
  console.log(pos1, pos2)
  var path = 'M' + pos1.x + ' ' + pos1.y + ' L' + pos2.x + ' ' + pos2.y;
  console.log(path);
  return this.path(path).attr({stroke: color, fill: "none", 'stroke-width': 3, 'arrow-end': 'classic-wide'});
};


Raphael.fn.box = function(x, y, width, height, input_count, output_count, color){
  var set_main = this.set();
  var shape = this.rect(x, y, width, height, 5);
  shape.x_offset = 0;
  shape.y_offset = 0;
  set_main.push(shape);

  var set_content = this.set();
  shape = this.text(x + 5, y, "Test Text").attr({font: "12px Fontin-Sans, Arial", fill: "#fff", "text-anchor": "start"});
  shape.x_offset = 5;
  shape.y_offset = 8;
  set_content.push(shape);
  set_content.label = 'contents';
  set_main.push(set_content);

  var set_inputs = this.set();
  for(var i = 0; i < input_count; i++){
    shape = this.rect(x - PORT_SIZE, y + PORT_SIZE + (i * PORT_SIZE), PORT_SIZE, PORT_SIZE, 2);
    shape.x_offset = -PORT_SIZE;
    shape.y_offset = PORT_SIZE + (i * PORT_SIZE);
    set_inputs.push(shape);
  }
  set_inputs.label = 'inputs';
  set_main.push(set_inputs);

  var set_outputs = this.set();
  for(var i = 0; i < output_count; i++){
    shape = this.rect(x + width, y + PORT_SIZE + (i * PORT_SIZE), PORT_SIZE, PORT_SIZE, 2);
    shape.x_offset = width;
    shape.y_offset = PORT_SIZE + (i * PORT_SIZE);
    set_outputs.push(shape);
  }
  set_outputs.label = 'outputs';
  set_main.push(set_outputs);

  set_main.data('myset', set_main);
  set_main.data('label', 'container');

  set_main.attr({"fill": color, "stroke": "#000"});
  return set_main;
}

Raphael.st.setContents = function(content){
  if(this.type === "set"){
    var pos = this.items[0].getPosition();  // item 0 is the parent shape.
    var x = pos.x;
    var y = pos.y;
    for(var i = 0; i < this.items.length; i++){
      if(this.items[i].label === 'contents'){
        var node;
        while(node = this.items[i].pop()){
          node.remove();
        }
        var shape = this.paper.text(x + 5, y, content.object_name).attr({font: "12px Fontin-Sans, Arial", fill: "black", "text-anchor": "start"});
        shape.x_offset = 5;
        shape.y_offset = 8;
        this.items[i].push(shape);
        shape = this.paper.text(0, 0, content.instance_name).attr({font: "12px Fontin-Sans, Arial", fill: "black", "text-anchor": "start"});
        shape.x_offset = 5;
        shape.y_offset = 22;
        this.items[i].push(shape);
        // For some reason new shapes added to a set do not appear until they are moved.
        setPosition(this.items[i], x, y);
      }
    }
  }
}

Raphael.st.setInputs = function(input_count){
  if(this.type === "set"){
    var pos = this.items[0].getPosition();  // item 0 is the parent shape.
    var x = pos.x;
    var y = pos.y;
    var color = this.items[0].attr('fill');
    for(var i = 0; i < this.items.length; i++){
      if(this.items[i].label === 'inputs'){
        var node;
        while(node = this.items[i].pop()){
          node.remove();
        }
        for(var j = 0; j < input_count; j++){
          var shape = this.paper.rect(x - PORT_SIZE, y + PORT_SIZE + (i * PORT_SIZE), PORT_SIZE, PORT_SIZE, 2);
          shape.x_offset = -PORT_SIZE;
          shape.y_offset = PORT_SIZE + (j * PORT_SIZE);
          shape.attr({"fill": color, "stroke": "#000"});
          this.items[i].push(shape);
        }
        // For some reason new shapes added to a set do not appear until they are moved.
        setPosition(this.items[i], x, y);
      }
    }
  }
}

Raphael.st.setOutputs = function(output_count){
  if(this.type === "set"){
    var pos = this.items[0].getPosition();  // item 0 is the parent shape.
    var x = pos.x;
    var y = pos.y;
    var width = this.items[0].attr('width');
    var color = this.items[0].attr('fill');
    for(var i = 0; i < this.items.length; i++){
      if(this.items[i].label === 'outputs'){
        var node;
        while(node = this.items[i].pop()){
          node.remove();
        }
        for(var j = 0; j < output_count; j++){
          var shape = this.paper.rect(x + width, y + PORT_SIZE + (i * PORT_SIZE), PORT_SIZE, PORT_SIZE, 2);
          shape.x_offset = width;
          shape.y_offset = PORT_SIZE + (j * PORT_SIZE);
          shape.attr({"fill": color, "stroke": "#000"});
          this.items[i].push(shape);
        }
        // For some reason new shapes added to a set do not appear until they are moved.
        setPosition(this.items[i], x, y);
      }
    }
  }
}

Raphael.el.getPosition = function(){
  return {x: this.data('myset')[0].attr("x"), y: this.data('myset')[0].attr("y")};
}

Raphael.el.setPosition = function(x, y){
  setPosition(this.data('myset'), x, y);
}

var setPosition = function(component, x, y){
  if(component.type === "set"){
    for(var i = 0; i < component.items.length; i++){
      setPosition(component.items[i], x, y);
    }
  } else {
    component.attr({x: x + component.x_offset, y: y + component.y_offset});
  }
}


