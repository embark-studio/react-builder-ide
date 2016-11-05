const {ipcRenderer} = require('electron');






// Do something according to a request of your mainview
ipcRenderer.on('render', function(e, json){
    Store.set("color", "#aaaaaa")
    Store.set("here", 1)
    Controller.on("here.increase", function(a){
        Store.set("here", Store.get("here") + 1)
    })
    Controller.on("here.decrease", function(a){
        Store.set("here", Store.get("here") - 1)
    })
    Controller.on("here.dark", function(a){
        Store.set("color", "#000")
    })

    ReactDOM.render(
        React.createElement(BuilderElement, json),
        document.getElementById('body')
    );

    Controller.on("nightowl.selected", function(selected){
        ipcRenderer.sendToHost("nightowl.selected", selected)
    })
});


