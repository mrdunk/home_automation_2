var PORT_SIZE = 10;

var objectTypes = {'alarm':          {'color':'blue', 'action':'new', callback: FlowObjectTimer},
                   'cloud-download': {'color':'red', 'action':'new', callback: FlowObjectMqttSubscribe},
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
      this.shareBetweenShapes = {unique_id: 0};
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
          } else {
            ha_control.disableMenuAdd(false);
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
        //shape = new FlowObjectMqttSubscribe(this.paper, this.sidebar, this.shareBetweenShapes);
        shape = new object_type.callback(this.paper, this.sidebar, this.shareBetweenShapes);
      } else {
        shape = new FlowObject(this.paper, this.sidebar, this.shareBetweenShapes, this.paper.box(0, 0, 50, 50, 2, 3, object_type.color));
      }
      shape.setBoxPosition(100,100);
      shape.displaySideBar();
      this.shapes.push(shape);
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

