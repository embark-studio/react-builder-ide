module.exports = {
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
