Controller = {
    "on":function(key, callback){
        this.initialize(key);

        this[key].push(callback)
    },
    "trigger":function(key, data){
        this.initialize(key);

        var i = this[key].length
        while(i != 0){
            this[key][this[key].length - i](data)
            i = i - 1
        }
    },
    "off":function(key, callback){
        this[key] = (this[key] || []).filter(function(event){
            return event != callback;
        })
    },
    "initialize":function(key){
        this[key] = this[key] || [];
    }
}

Store = function(key){
    var me = {};
    me.key = key;
    me.store = function(key){
        return Store([m.key, key].join("."));
    }
    me.set = function(value){
        Store.set(me.key, value)
    }
    me.get = function(){
        Store.get(me.key)
    }
    me.increase = function(){
        Store.increase(me.key)
    }
    me.decrease = function(){
        Store.decrease(me.key)
    }

    return me;
}
Store.set = function(key, value){
        this.data[key] = value;
        return Controller.trigger(key+".set")
    }

Store.get = function(key){
        if(this.data[key] && typeof this.data[key] == "object") {
            if(Array.isArray(this.data[key])){
                return this.data[key].map(function(data){
                    return JSON.parse(JSON.stringify(data));
                })
            }else {
                return JSON.parse(JSON.stringify(this.data[key]));
            }
        }else{
            return this.data[key];
        }
    }

Store.increase = function(key){
    var value = (Store.get(key) || 0) + 1;
    Store.set(key, value)
}
Store.decrease = function(key){
    var value = (Store.get(key) || 0) - 1;
    Store.set(key, value)
}

Store.data = {}



BuilderElement = React.createClass({
    displayName: "BuilderElement",
    update: function(key){

        var data = {};
        data[key] = Store.get(key)
        this.setState(data)
    },
    getInitialState: function(){
        var c = this;
        var initialData = {}

        if(this.props.stores) {
            this.props.stores.forEach(function (item) {
                if(typeof item == "string"){
                    var key = item;
                    var value = item;
                }else{
                    var key = Object.keys(item)[0];
                    var value = item[key];
                }

                initialData[value] = Store.get(key);

                Controller.on(key + ".set", c.update.bind(c, value))
            })
        }

        Controller.on("nightowl.development.set", c.update.bind(c, "development"))
        return initialData;
    },
    componentWillUnmount: function(){
        var c = this;
        if(this.props.stores) {
            this.props.stores.forEach(function (key) {
                Controller.off(key, c.update.bind(c, "development"))
            })
        }
        Controller.off("nightowl.development.set", c.update.bind(c, "development"))
    },
    childElement: function(data){
        var c = this;
        if(typeof data =="object" ){
            if(Array.isArray(data)) {
                return data.map(function(arrayData, i){
                    if(typeof arrayData == "object"){
                        arrayData.key = "key-" + i
                        arrayData.index = i;
                        return React.createElement(
                            BuilderElement,
                            arrayData
                        )
                    }else{
                        return c.parse(arrayData);
                    }
                })
            }else{
                return React.createElement(
                    BuilderElement,
                    data
                )
            }
        }else if(typeof data == "string" ){
            return c.parse(data);
        }
    },
    parse: function(item){
        formatted = "'" + item.replace('{', "'+").replace('}', "+'") + "'"
        return eval(formatted)
    },
    render: function render() {
        var c = this;
        var elementName = this.props.elementName;
        var props = JSON.parse(JSON.stringify(this.props));
        delete props.elementName;
        delete props.index;
        delete props.data;
        delete props.stores;


        Object.keys(props).forEach(function(prop){
            if(prop.slice(0, 2) == "on"){
                var trigger = props[prop];
                props[prop] = function(e){
                    props.e = e;
                    Controller.trigger(trigger, props)
                }
            }else{
                if(typeof props[prop] == "string") {
                    props[prop] = c.parse(props[prop]);
                }else if(prop == "style"){
                    Object.keys(props.style).forEach(function(styleKey){
                        props.style[styleKey] = c.parse(props.style[styleKey]);
                    })
                }
            }
        })
        props.children = typeof props.children == "string" ? c.parse(props.children) : props.children;
        selectElement = function(){
            Controller.trigger("nightowl.selected", props)
        }
        var display = this.state.development ? "block" : "none";
        return React.createElement("div", {style: {display: "inline-block"}},
            React.createElement("div", {className: "nightowl-sdk-item", style: {display: display}, onClick: selectElement}, elementName),
            React.createElement(
                elementName,
                props,
                this.childElement(this.props.children)
            )
        )
    }

});

document.onkeydown = function(evt) {
    evt = evt || window.event;
    if (evt.ctrlKey) {
        if(Store.get("development") != true){
            Store.set("nightowl.development", true)
        }

    }
};

document.onkeyup = function(evt) {
    Store.set("nightowl.development", false)
};

if(typeof module != "undefined") {
    module.exports = {
        Builder: {
            ReactElement: BuilderElement,
            Controller: Controller,
            Store: Store
        }
    }
}