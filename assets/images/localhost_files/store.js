var Store = function(dataKey){
  var store = {
    dataKey: dataKey,
    db: Store.db,
    merge: function(data){
      var currentData = this.db.get(this.dataKey);
      if(!(typeof currentData == "object" && !Array.isArray(currentData))){
        this.store(this.dataKey).set({})
      }
      return this.db.merge(this.dataKey, data);
    },
    setDefault: function(data){
      return this.db.setDefault(this.dataKey, data);
    },
    set: function(data){
      return this.db.set(this.dataKey, data);
    },
    push: function(data){
      var sourceData = (this.db.get(this.dataKey) || []);
      var mergedData = sourceData.concat([data]);
      return this.db.set(this.dataKey, mergedData);
    },
    remove: function(data){
      var sourceData = (this.db.get(this.dataKey) || []);
      if(sourceData.indexOf(data) != -1){
        sourceData.splice(sourceData.indexOf(data), 1);
        return this.db.set(this.dataKey, sourceData);
      }
      return this.db.get(this.dataKey);
    },
    get: function(){
      return this.db.get(this.dataKey);
    },
    increase: function(){
      return this.db.increase(dataKey)
    },
    decrease: function(){
      return this.db.decrease(dataKey)
    },
    was: function(){
      return this.db.was(dataKey)
    },
    store: function(subDataKey){
      return Store(this.dataKey + "." + subDataKey)
    },
    trigger: function(action){
      return this.db.observable.trigger(this.dataKey + "." + action);
    },
    remember: function(){
      this.db.remembers.push(this.dataKey)

      var data = this.db.storage.get();
      if(data && data[this.dataKey]){
        this.db.data[this.dataKey] = data[this.dataKey];
      }
    }
  }

  Object.keys(Store.db.on(dataKey)).forEach(function(key){
    var newTriggerName = "on" + key[0].toUpperCase() + key.slice(1, key.length)
    store[newTriggerName] = function(var1, var2){
      return store.db.on(dataKey)[key](var1, var2);
    }
  })

  return store;
}
Store.ReactMixin = StoresMixin = {
  getInitialState: function(){
    this.stores = this.stores || {}
    this.setStores();

    var state = {};
    var c = this;
    Object.keys(this.stores).forEach(function(key){
      var store = c.stores[key];
      state[key] = store.get();
    })

    return state;
  },

  componentDidMount: function(){
    var c = this
    Object.keys(this.stores).forEach(function(key){
      var store = c.stores[key];

      callback = function(){
        var state = {};
        state[key] = store.get();

        c.setState(state);
      }

      c.detachables.push(store.onChange(callback))
    })
  },

  componentWillUnmount: function(){
    this.detachables = this.detachables || []
    this.detachables.forEach(function(store){
      store.detach()
    })
  },

  followChange: function(change){
    this.detachables.push(change)
  },

  setStores: function(){
    this.detachables = [];
    var followStores = {}

    if(typeof this.followStores == "function"){
      followStores = this.followStores()
    }else {
      followStores = this.followStores
    }

    if(followStores instanceof Array){
      var fs = followStores;
      followStores = {};
      fs.forEach(function(item){
        if(item instanceof Object) {
          key = Object.keys(item)[0];
          followStores[key] = item[key];
        }else{
          followStores[item] = item;
        }
      })
    }

    var followStores = followStores || {};

    var c = this;

    Object.keys(followStores).forEach(function(key){

      c.stores[key] = Store(followStores[key])
    })
  }
}

Store.reactComponent = function(component){
  var component = component;
  component.stores = component.stores || {};
  component.store = Store;
  component.detachables = this.detachables || [];
  component.stores.follow = function(keyAndStore){
    var key = Object.keys(keyAndStore)[0];
    var store = keyAndStore[key];
    var stores = this;
    stores[key] = component.store(store);
    callback = function(data){
      var data = component.store(store).get();
      var newState = {};
      newState[key] = data;
      component.setState(newState);
    }
    callback();
    var detachable = component.store(store).onChange(callback);
    stores[key].forget = function(){ detachable.detach() };
    component.stores.detachables = component.stores.detachables || [];
    component.stores.detachables.push(detachable);
  }
  component.stores.forget = function(storeName){
    this.detachables.forEach(function(store){
      store.detach();
    })
  }
  componentWillUnmount = component.componentWillUnmount || function(){};
  component.componentWillUnmount = function(opts){
    component.stores.forget();
    componentWillUnmount.bind(component, opts);
  }
  return component;
}

Store.db = (function(store) {


  /*****************************************************
   *****************************************************
   ***
   ***   SETUP
   ***
   *****************************************************
   *****************************************************/

  store.observable = {};
  store.data = {};
  store.dataWas = {};
  store.debug = false
  store.remembers = [];
  store.setRemembers = function(){
    store.remembers.forEach(function(rememberer){
      store.data[rememberer] = (store.storage.get() || {})[rememberer];
    })
  }

  store.storage = function(set, get){
    this.storage.set = set;
    this.storage.get = get;
    if(get){
      store.setRemembers();
    }
  }

  if(typeof sessionStorage != "undefined"){
    store.sessionStorage = sessionStorage;
  }

  if(store.sessionStorage){
    store.sessionStorage = sessionStorage;
    store.storage.set = function(data){
      store.sessionStorage.setItem("observable-store", JSON.stringify(data));
    }

    store.storage.get = function(data){
      if(store.sessionStorage.getItem("observable-store")){
        return JSON.parse(store.sessionStorage.getItem("observable-store"));
      }
    }

    if(store.storage.get()){
      store.setRemembers()
    }

    try{
      if(store.sessionStorage.getItem("observable-store")){
        store.storage.get(JSON.parse(store.sessionStorage.getItem("observable-store")));
      }
    }catch(e){
      console.log(e)
    }
  }

  /*****************************************************
   *****************************************************
   ***
   ***   MD5
   ***
   *****************************************************
   *****************************************************/

  store.md5 = (function ($) {
    'use strict'

    /*
    * Add integers, wrapping at 2^32. This uses 16-bit operations internally
    * to work around bugs in some JS interpreters.
    */
    function safe_add (x, y) {
      var lsw = (x & 0xFFFF) + (y & 0xFFFF)
      var msw = (x >> 16) + (y >> 16) + (lsw >> 16)
      return (msw << 16) | (lsw & 0xFFFF)
    }

    /*
    * Bitwise rotate a 32-bit number to the left.
    */
    function bit_rol (num, cnt) {
      return (num << cnt) | (num >>> (32 - cnt))
    }

    /*
    * These functions implement the four basic operations the algorithm uses.
    */
    function md5_cmn (q, a, b, x, s, t) {
      return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b)
    }
    function md5_ff (a, b, c, d, x, s, t) {
      return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t)
    }
    function md5_gg (a, b, c, d, x, s, t) {
      return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t)
    }
    function md5_hh (a, b, c, d, x, s, t) {
      return md5_cmn(b ^ c ^ d, a, b, x, s, t)
    }
    function md5_ii (a, b, c, d, x, s, t) {
      return md5_cmn(c ^ (b | (~d)), a, b, x, s, t)
    }

    /*
    * Calculate the MD5 of an array of little-endian words, and a bit length.
    */
    function binl_md5 (x, len) {
      /* append padding */
      x[len >> 5] |= 0x80 << (len % 32)
      x[(((len + 64) >>> 9) << 4) + 14] = len

      var i
      var olda
      var oldb
      var oldc
      var oldd
      var a = 1732584193
      var b = -271733879
      var c = -1732584194
      var d = 271733878

      for (i = 0; i < x.length; i += 16) {
        olda = a
        oldb = b
        oldc = c
        oldd = d

        a = md5_ff(a, b, c, d, x[i], 7, -680876936)
        d = md5_ff(d, a, b, c, x[i + 1], 12, -389564586)
        c = md5_ff(c, d, a, b, x[i + 2], 17, 606105819)
        b = md5_ff(b, c, d, a, x[i + 3], 22, -1044525330)
        a = md5_ff(a, b, c, d, x[i + 4], 7, -176418897)
        d = md5_ff(d, a, b, c, x[i + 5], 12, 1200080426)
        c = md5_ff(c, d, a, b, x[i + 6], 17, -1473231341)
        b = md5_ff(b, c, d, a, x[i + 7], 22, -45705983)
        a = md5_ff(a, b, c, d, x[i + 8], 7, 1770035416)
        d = md5_ff(d, a, b, c, x[i + 9], 12, -1958414417)
        c = md5_ff(c, d, a, b, x[i + 10], 17, -42063)
        b = md5_ff(b, c, d, a, x[i + 11], 22, -1990404162)
        a = md5_ff(a, b, c, d, x[i + 12], 7, 1804603682)
        d = md5_ff(d, a, b, c, x[i + 13], 12, -40341101)
        c = md5_ff(c, d, a, b, x[i + 14], 17, -1502002290)
        b = md5_ff(b, c, d, a, x[i + 15], 22, 1236535329)

        a = md5_gg(a, b, c, d, x[i + 1], 5, -165796510)
        d = md5_gg(d, a, b, c, x[i + 6], 9, -1069501632)
        c = md5_gg(c, d, a, b, x[i + 11], 14, 643717713)
        b = md5_gg(b, c, d, a, x[i], 20, -373897302)
        a = md5_gg(a, b, c, d, x[i + 5], 5, -701558691)
        d = md5_gg(d, a, b, c, x[i + 10], 9, 38016083)
        c = md5_gg(c, d, a, b, x[i + 15], 14, -660478335)
        b = md5_gg(b, c, d, a, x[i + 4], 20, -405537848)
        a = md5_gg(a, b, c, d, x[i + 9], 5, 568446438)
        d = md5_gg(d, a, b, c, x[i + 14], 9, -1019803690)
        c = md5_gg(c, d, a, b, x[i + 3], 14, -187363961)
        b = md5_gg(b, c, d, a, x[i + 8], 20, 1163531501)
        a = md5_gg(a, b, c, d, x[i + 13], 5, -1444681467)
        d = md5_gg(d, a, b, c, x[i + 2], 9, -51403784)
        c = md5_gg(c, d, a, b, x[i + 7], 14, 1735328473)
        b = md5_gg(b, c, d, a, x[i + 12], 20, -1926607734)

        a = md5_hh(a, b, c, d, x[i + 5], 4, -378558)
        d = md5_hh(d, a, b, c, x[i + 8], 11, -2022574463)
        c = md5_hh(c, d, a, b, x[i + 11], 16, 1839030562)
        b = md5_hh(b, c, d, a, x[i + 14], 23, -35309556)
        a = md5_hh(a, b, c, d, x[i + 1], 4, -1530992060)
        d = md5_hh(d, a, b, c, x[i + 4], 11, 1272893353)
        c = md5_hh(c, d, a, b, x[i + 7], 16, -155497632)
        b = md5_hh(b, c, d, a, x[i + 10], 23, -1094730640)
        a = md5_hh(a, b, c, d, x[i + 13], 4, 681279174)
        d = md5_hh(d, a, b, c, x[i], 11, -358537222)
        c = md5_hh(c, d, a, b, x[i + 3], 16, -722521979)
        b = md5_hh(b, c, d, a, x[i + 6], 23, 76029189)
        a = md5_hh(a, b, c, d, x[i + 9], 4, -640364487)
        d = md5_hh(d, a, b, c, x[i + 12], 11, -421815835)
        c = md5_hh(c, d, a, b, x[i + 15], 16, 530742520)
        b = md5_hh(b, c, d, a, x[i + 2], 23, -995338651)

        a = md5_ii(a, b, c, d, x[i], 6, -198630844)
        d = md5_ii(d, a, b, c, x[i + 7], 10, 1126891415)
        c = md5_ii(c, d, a, b, x[i + 14], 15, -1416354905)
        b = md5_ii(b, c, d, a, x[i + 5], 21, -57434055)
        a = md5_ii(a, b, c, d, x[i + 12], 6, 1700485571)
        d = md5_ii(d, a, b, c, x[i + 3], 10, -1894986606)
        c = md5_ii(c, d, a, b, x[i + 10], 15, -1051523)
        b = md5_ii(b, c, d, a, x[i + 1], 21, -2054922799)
        a = md5_ii(a, b, c, d, x[i + 8], 6, 1873313359)
        d = md5_ii(d, a, b, c, x[i + 15], 10, -30611744)
        c = md5_ii(c, d, a, b, x[i + 6], 15, -1560198380)
        b = md5_ii(b, c, d, a, x[i + 13], 21, 1309151649)
        a = md5_ii(a, b, c, d, x[i + 4], 6, -145523070)
        d = md5_ii(d, a, b, c, x[i + 11], 10, -1120210379)
        c = md5_ii(c, d, a, b, x[i + 2], 15, 718787259)
        b = md5_ii(b, c, d, a, x[i + 9], 21, -343485551)

        a = safe_add(a, olda)
        b = safe_add(b, oldb)
        c = safe_add(c, oldc)
        d = safe_add(d, oldd)
      }
      return [a, b, c, d]
    }

    /*
    * Convert an array of little-endian words to a string
    */
    function binl2rstr (input) {
      var i
      var output = ''
      for (i = 0; i < input.length * 32; i += 8) {
        output += String.fromCharCode((input[i >> 5] >>> (i % 32)) & 0xFF)
      }
      return output
    }

    /*
    * Convert a raw string to an array of little-endian words
    * Characters >255 have their high-byte silently ignored.
    */
    function rstr2binl (input) {
      var i
      var output = []
      output[(input.length >> 2) - 1] = undefined
      for (i = 0; i < output.length; i += 1) {
        output[i] = 0
      }
      for (i = 0; i < input.length * 8; i += 8) {
        output[i >> 5] |= (input.charCodeAt(i / 8) & 0xFF) << (i % 32)
      }
      return output
    }

    /*
    * Calculate the MD5 of a raw string
    */
    function rstr_md5 (s) {
      return binl2rstr(binl_md5(rstr2binl(s), s.length * 8))
    }

    /*
    * Calculate the HMAC-MD5, of a key and some data (raw strings)
    */
    function rstr_hmac_md5 (key, data) {
      var i
      var bkey = rstr2binl(key)
      var ipad = []
      var opad = []
      var hash
      ipad[15] = opad[15] = undefined
      if (bkey.length > 16) {
        bkey = binl_md5(bkey, key.length * 8)
      }
      for (i = 0; i < 16; i += 1) {
        ipad[i] = bkey[i] ^ 0x36363636
        opad[i] = bkey[i] ^ 0x5C5C5C5C
      }
      hash = binl_md5(ipad.concat(rstr2binl(data)), 512 + data.length * 8)
      return binl2rstr(binl_md5(opad.concat(hash), 512 + 128))
    }

    /*
    * Convert a raw string to a hex string
    */
    function rstr2hex (input) {
      var hex_tab = '0123456789abcdef'
      var output = ''
      var x
      var i
      for (i = 0; i < input.length; i += 1) {
        x = input.charCodeAt(i)
        output += hex_tab.charAt((x >>> 4) & 0x0F) +
        hex_tab.charAt(x & 0x0F)
      }
      return output
    }

    /*
    * Encode a string as utf-8
    */
    function str2rstr_utf8 (input) {
      return unescape(encodeURIComponent(input))
    }

    /*
    * Take string arguments and return either raw or hex encoded strings
    */
    function raw_md5 (s) {
      return rstr_md5(str2rstr_utf8(s))
    }
    function hex_md5 (s) {
      return rstr2hex(raw_md5(s))
    }
    function raw_hmac_md5 (k, d) {
      return rstr_hmac_md5(str2rstr_utf8(k), str2rstr_utf8(d))
    }
    function hex_hmac_md5 (k, d) {
      return rstr2hex(raw_hmac_md5(k, d))
    }

    function md5 (string, key, raw) {
      if (!key) {
        if (!raw) {
          return hex_md5(string)
        }
        return raw_md5(string)
      }
      if (!raw) {
        return hex_hmac_md5(key, string)
      }
      return raw_hmac_md5(key, string)
    }

    return md5;
  })()

  var md5 = store.md5;

  /*****************************************************
   *****************************************************
   ***
   ***   OBSERVABLE
   ***
   *****************************************************
   *****************************************************/

  /**
   * Extend the original object or create a new empty one
   * @type { Object }
   */

  var el = store.observable;

  /**
   * Private variables and methods
   */

  var callbacks = {},
    onEachEvent = function(e, fn) { e.replace(/\S+/g, fn) },
    defineProperty = function (key, value) {
      Object.defineProperty(el, key, {
        value: value,
        enumerable: false,
        writable: false,
        configurable: false
      })
    }

  /**
   * Listen to the given space separated list of `events` and execute the `callback` each time an event is triggered.
   * @param  { String } events - events ids
   * @param  { Function } fn - callback function
   * @returns { Object } el
   */
  defineProperty('on', function(events, fn) {
    if (typeof fn != 'function')  return el

    onEachEvent(events, function(name, pos) {
      (callbacks[name] = callbacks[name] || []).push(fn)
      fn.typed = pos > 0
    })

    return el
  })

  /**
   * Removes the given space separated list of `events` listeners
   * @param   { String } events - events ids
   * @param   { Function } fn - callback function
   * @returns { Object } el
   */

  defineProperty('off', function(events, fn) {
    if (events == '*') callbacks = {}
    else {
      onEachEvent(events, function(name) {
        if (fn) {
          var arr = callbacks[name]
          for (var i = 0, cb; cb = arr && arr[i]; ++i) {
            if (cb == fn) arr.splice(i--, 1)
          }
        } else delete callbacks[name]
      })
    }
    return el
  })

  /**
   * Listen to the given space separated list of `events` and execute the `callback` at most once
   * @param   { String } events - events ids
   * @param   { Function } fn - callback function
   * @returns { Object } el
   */

  defineProperty('one', function(events, fn) {
    function on() {
      el.off(events, on)
      fn.apply(el, arguments)
    }
    return el.on(events, on)
  })

  /**
   * Execute all callback functions that listen to the given space separated list of `events`
   * @param   { String } events - events ids
   * @returns { Object } el
   */

  defineProperty('trigger', function(events) {

    // getting the arguments
    // skipping the first one
    var arglen = arguments.length - 1,
      args = new Array(arglen)
    for (var i = 0; i < arglen; i++) {
      args[i] = arguments[i + 1]
    }

    onEachEvent(events, function(name) {

      var fns = (callbacks[name] || []).slice(0)

      for (var i = 0, fn; fn = fns[i]; ++i) {
        if (fn.busy) return
        fn.busy = 1

        try {
          fn.apply(el, fn.typed ? [name].concat(args) : args)
        } catch (e) { el.trigger('error', e) }
        if (fns[i] !== fn) { i-- }
        fn.busy = 0
      }

      if (callbacks.all && name != 'all')
        el.trigger.apply(el, ['all', name].concat(args))

    })

    return el
  })


  /*****************************************************
   *****************************************************
   ***
   ***   STORE FUNCTIONALITY
   ***
   *****************************************************
   *****************************************************/
  // PERSISTENT STORAGE
  store.remembers = [];

  store.trigger = function(name){
    this.observable.trigger()
  }
  store.get = function(name){
    var data = this.data[name]

    if(typeof data == "object"){
      data = JSON.parse(JSON.stringify(data))
    }

    return data;
  }
  store.was = function(name){
    return this.dataWas[name];
  }
  store.setDefault = function(name, defaultData){
    var data = this.data[name] || defaultData;
    return store.set(name, data);
  }
  store.merge = function(name, data){
    var dataWas = JSON.parse(JSON.stringify(this.get(name)));
    if(typeof data != "object" || (typeof data == "object " && "length" in data)){
      throw "Merge requires params to be object";
    }

    if(typeof dataWas != "object" || (typeof dataWas == "object " && "length" in data)){
      throw "Merge requires source data to be object";
    }


    Object.keys(data).forEach(function(key){
      dataWas[key] = data[key];
    })

    this.set(name, dataWas);

  }

  store.set = function(name, data){
    this.dataWas[name] = this.data[name]
    this.data[name] = data;

    if(!this.dataWas[name] || this.dataWas[name] != data){
      this.observable.trigger(name + '.change')
    }else if(this.dataWas[name] && this.dataWas[name] == data){
      this.observable.trigger(name + '.update')
    }
    if(!this.dataWas[name]){
      this.observable.trigger(name + '.create')
    }
    if(this.dataWas[name] && !this.data[name]){
      this.observable.trigger(name + '.empty')
    }
    if(this.dataWas[name] && (this.data[name] == '' || !this.data[name])){
      this.observable.trigger(name + '.blank')
    }
    if(this.data[name] != '' && this.data[name]){
      this.observable.trigger(name + '.notBlank')
    }

    if(typeof this.data[name] == "object" && !(Array.isArray(this.data[name]))){
      this.observable.trigger(name + '.isObject')
    }

    if(typeof this.data[name] == "object" && Array.isArray(this.data[name])){
      this.observable.trigger(name + '.isArray')
    }

    if(typeof this.data[name] == "string"){
      this.observable.trigger(name + '.isString')
    }

    if(typeof this.data[name] == "number"){
      this.observable.trigger(name + '.isNumber')
    }

    if(typeof this.data[name] == "number" && this.data[name] > this.dataWas[name]){
      this.observable.trigger(name + '.increase')
    }

    if(typeof this.data[name] == "number" && this.data[name] < this.dataWas[name]){
      this.observable.trigger(name + '.decrease')
    }

    if(typeof this.data[name] == "object"){
      triggerData = JSON.stringify(this.data[name]);
    }else{
      triggerData = this.data[name];
    }

    this.observable.trigger(name + "." + md5(triggerData))

    this.observable.trigger(name)
    this.observable.trigger("update")

    if(store.storage.get && store.storage.set){
      var storageData = store.storage.get() || {};
      db = this

      this.remembers.forEach(function(dataName){
        storageData[dataName] = db.data[dataName];
      })

      if(Object.keys(storageData).length != 0 && store.storage.set && this.remembers.length != 0){
        store.storage.set(storageData);
      }
    }

    return this.data[name];
  }

  store.increase = function(name){
    this.data[name] = this.data[name] || 0;
    if(typeof this.data[name] == "number"){
      this.set(name, this.data[name] + 1)
    }
  }
  store.decrease = function(name){
    this.data[name] = this.data[name] || 0;
    if(typeof this.data[name] == "number"){
      this.set(name, this.data[name] - 1)
    }
  }

  store.on = function(name){
    var store = this;
    var observable = {};
    observable.name = name;
    observable.observe = function(trigger, callback){
      var detachable = {};
      if(typeof trigger == 'function'){
        callback = trigger;
        trigger = undefined;
      }
      if(trigger){
        detachable.trigger = observable.name + '.' + trigger;
      }else{
        detachable.trigger = observable.name;
      }
      if(typeof callback == "function"){
        callback = callback.bind(store)
      }
      detachable.callback = callback;
      store.observable.on(detachable.trigger, callback);
      detachable.detach = function(){
        return store.observable.off(detachable.trigger, this.callback);
      }
      detachable.react = function(component){
        oldComponenentWillUnmount = component.componentWillUnmount
        component.componentWillUnmount = function(){
          if(oldComponenentWillUnmount){
            oldComponenentWillUnmount.bind(component)
          }
          detachable.detach()
        }
        return store.observable.off(detachable.trigger, this.callback);
      }
      return detachable
    }
    observable.update = function(callback){
      return this.observe('update', callback);
    }
    observable.change = function(callback){
      return this.observe('change', callback);
    }
    observable.empty = function(callback){
      return this.observe('empty', callback);
    }
    observable.blank = function(callback){
      return this.observe('blank', callback);
    }
    observable.create = function(callback){
      return this.observe('create', callback);
    }
    observable.notBlank = function(callback){
      return this.observe('notBlank', callback);
    }
    observable.isObject = function(callback){
      return this.observe('isObject', callback);
    }
    observable.isArray = function(callback){
      return this.observe('isArray', callback);
    }
    observable.isString = function(callback){
      return this.observe('isString', callback);
    }
    observable.isNumber = function(callback){
      return this.observe('isNumber', callback);
    }
    observable.increase = function(callback){
      return this.observe('increase', callback);
    }
    observable.decrease = function(callback){
      return this.observe('decrease', callback);
    }
    observable.isEqualTo = function(value, callback){
      if(typeof value == "object"){
        value = JSON.stringify(value)
      }
      return this.observe(md5(value), callback);
    }
    return observable;
  }
  return store;
})({})
if(typeof module != 'undefined' && module.exports){
  module.exports = Store;
}
