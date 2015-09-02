
xtag.register('button-show-content', {
  expanded: false,
  lifecycle:{
    created: function(){
      // fired once at the time a component
      // is initially created or parsed
      console.log("button-show-content.lifecycle.created");
      var template = document.getElementById('button-show-content').content;
      this.appendChild(template.cloneNode(true));
    },
    inserted: function(){
      // fired each time a component
      // is inserted into the DOM
      console.log("button-show-content.lifecycle.inserted");
    }
  },
  events: {
    'click': function(){
      console.log("button-show-content.events.click");
      this.expanded = !this.expanded;
      if(this.expanded === false){
        this.getElementsByClassName("button-show-content-show")[0].style.display = "block";
        this.getElementsByClassName("button-show-content-hide")[0].style.display = "none";
      } else {
        this.getElementsByClassName("button-show-content-show")[0].style.display = "none";
        this.getElementsByClassName("button-show-content-hide")[0].style.display = "block";
      }
    }
  }
});

xtag.register('draw-container', {
  lifecycle:{
    created: function(){
      // fired once at the time a component
      // is initially created or parsed
      console.log("draw-container.lifecycle.created");
      var template = document.getElementById('draw-container').innerHTML;
      xtag.innerHTML(this, template);

      this.getElement = function(element_name){
        var elements = this.getElementsByTagName('draw-element');
        for(var i=0; i < elements.length; i++){
          if(xtag.hasClass(elements[i], element_name)){
            return elements[i];
          }
        }
      }

      this.setElement = function(element_name, element_value){
        console.log(element_value);
        var element = this.getElement(element_name);
        if(element){
          // already exists.
        } else{
          var element = document.createElement('draw-element');
          this.getElementsByClassName("draw-elements")[0].appendChild(element);
          element.element_name = element_name;
          element.element_parent = this;
        }
        element.element_value = element_value;

        element.switch = false;
        for(var k in element_value){
          // If any color is switched on...
          if(element_value[k]){
            // display the switch in the "on" position for this element
            element.switch = true;
          }
        }
        // Now make sure the parent's switch is displayed correctly...
        element.parentElement.parentElement.switch = false;
        var peer_switches = this.getElementsByClassName('draw-elements')[0].getElementsByTagName("light-switch");
        for(var i = 0; i < peer_switches.length; i++){
          if(peer_switches[i].on_off){
            element.parentElement.parentElement.switch = true;
          }
        }
      }
    }
  },
  events: {
    'click:delegate(button-show-content)': function(){
      
      // Because this is a delgated function, it runs in the context of button-show-content,
      // therfore we must use the .parentElement.
      var contents = this.parentElement.parentElement.getElementsByClassName("draw-elements")[0];
      if(this.expanded){
        contents.style.display = "block";
      } else {
        contents.style.display = "none";
      }
    }
  },
  accessors: {
    'draw_name': {
      set: function(name){
             xtag.addClass(this, "__rooms");
             xtag.addClass(this, name);
             this.getElementsByClassName("draw-name")[0].innerHTML = name;
             this.title = name;
      }
    },
    'switch': {
      set: function(state){
        var switchIcon = this.getElementsByClassName('draw-header')[0].getElementsByTagName("light-switch")[0];
        if(switchIcon){
          switchIcon.switched = state;
        }
      //},
      //get: function(){
      //  console.log('&&&&');
      }
    }
  }
});

xtag.register('draw-element', {
  element_value: "",
  //element_parent: null,
  lifecycle:{
    created: function(){
      // fired once at the time a component
      // is initially created or parsed
      console.log("draw-element.lifecycle.created");
      var template = document.getElementById('draw-element').innerHTML;
      xtag.innerHTML(this, template);

      this.element_parent = null;
    }
  },
  accessors: {
    'element_value': {
      set: function(value){
        this.getElementsByClassName("element-value")[0].innerHTML = JSON.stringify(value);
      }
    },
    'element_name': {
      set: function(name){
        this.getElementsByClassName("element-name")[0].innerHTML = name;
        xtag.addClass(this, "__device");
        xtag.addClass(this, name);
        this.title = name;
      }
    },
    'switch': {
      set: function(state){
        var switchIcon = this.getElementsByTagName("light-switch")[0];
        switchIcon.switched = state;
      }
    }
  }
});

xtag.register('light-switch', {
  on_off: false,
  lifecycle:{
    created: function(){
      var template = document.getElementById('light-switch').innerHTML;
      xtag.innerHTML(this, template);

      if (this.parentElement.parentElement.element_name){
        console.log("device:", this.parentElement.parentElement.element_name);
      } else if (this.parentElement.parentElement.draw_name){
        console.log("room:", this.parentElement.parentElement.draw_name);
      } else {
        console.log("room:", this.parentElement.parentElement.draw_name);
      }
    }
  },
  accessors: {
    'switched': {
      set: function(value){
        this.on_off = value;
        if (this.on_off) {
          this.style.color = "#ffb";
        } else {
          this.style.color = "#bbb";
        }
      }
    }
  },
  events: {
    'click': function(){
      var send_data;
      if(this.on_off){
        // Currently on. will be turning off.
        send_data = 'off';
      } else {
        // Currently off. will be turning on.
        send_data = 'on';
      }

      if(!this.room){
        if(this.parentElement.parentElement.localName === "draw-container"){
          this.room = this.parentElement.parentElement.title;
          this.device = "all";
        } else if(this.parentElement.parentElement.localName === "draw-element"){
          this.room = this.parentElement.parentElement.parentElement.parentElement.title;
          this.device = this.parentElement.parentElement.title;
        }
      }

      Mqtt.send(send_data, 'homeautomation/devices/lighting/' + this.room + '/' + this.device + '/set');
      Page.AppendToLog('homeautomation/devices/lighting/' + this.room + '/' + this.device + '/set = ' + send_data, 'RED')

      this.switched = !this.on_off;  // To trigger accessors.switched.set.
    }
  }
});
