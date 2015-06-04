
xtag.register('button-show-content', {
  // extend existing elements
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
  // extend existing elements
  //expanded: false,
  lifecycle:{
    created: function(){
      // fired once at the time a component
      // is initially created or parsed
      console.log("draw-container.lifecycle.created");
      var template = document.getElementById('draw-container').innerHTML;
      xtag.innerHTML(this, template);
    },
    inserted: function(){
      // fired each time a component
      // is inserted into the DOM
      console.log("draw-container.lifecycle.inserted");
    }
  },
  events: {
    'click:delegate(button-show-content)': function(){
      console.log("draw-container.events.click:delegate(button-show-content)");
      
      // Because this is a delgated function, it runs in the context of button-show-content,
      // therfore we must use the .parentElement.
      var contents = this.parentElement.getElementsByClassName("elements")[0];
      if(this.expanded){
        contents.style.display = "block";
      } else {
        contents.style.display = "none";
      }
    }
  }
});

xtag.register('draw-element', {
  // extend existing elements
  lifecycle:{
    created: function(){
      // fired once at the time a component
      // is initially created or parsed
      console.log("draw-element.lifecycle.created");
      var template = document.getElementById('draw-element').innerHTML;
      xtag.innerHTML(this, template);
    },
    inserted: function(){
      // fired each time a component
      // is inserted into the DOM
      console.log("draw-element.lifecycle.inserted");
    }
  },
  events: {
    'click': function(){
      console.log("draw-element.events.click");
      if(this.expanded === false){
        this.expanded = true;
      } else {
        this.expanded = false;
      }
    }
  }
});

