
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

      this.appendChild = function(new_child){
        this.getElementsByClassName("draw-elements")[0].appendChild(new_child);
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
    }
  }
});

xtag.register('draw-element', {
  element_value: "",
  lifecycle:{
    created: function(){
      // fired once at the time a component
      // is initially created or parsed
      console.log("draw-element.lifecycle.created");
      var template = document.getElementById('draw-element').innerHTML;
      xtag.innerHTML(this, template);
    }
  },
  accessors: {
    'element_value': {
      set: function(value){
        this.getElementsByClassName("element-value")[0].innerHTML = value;
      }
    },
    'element_name': {
      set: function(name){
        this.getElementsByClassName("element-name")[0].innerHTML = name;
        xtag.addClass(this, "__device");
        xtag.addClass(this, name);
        this.title = name;
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
        send_data = '#000';
      } else {
        // Currently off. will be turning on.
        send_data = '#fff';
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

      console.log(this.room, this.device);
      //Mqtt.send(send_data, 'homeautomation/lighting/all/all/set');
      this.switched = !this.on_off;  // To trigger accessors.switched.set.
    }
  }
});
