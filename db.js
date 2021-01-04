/*
Creates & maintains a MongoDB connection.
+ Makes working with mongoose a lot easier.


Packages required:
+ mongoose

*/


/********************************************* CONFIGURATION **********************************************/


const defaultSort = {created: -1}





/********************************************* SETUP FUNCTIONS **********************************************/


//Load required packages.
const mongo = require("mongoose")
mongo.set("useFindAndModify", false)
mongo.set("useCreateIndex", true)


//Export primary function.
module.exports = DB
module.exports.fields = getFields
module.exports.customFunctions = customFunctions





/********************************************* PRIMARY FUNCTIONS **********************************************/


/*
The database function.
*/
function DB(srv = process.env.MONGO_URI, schemas, options) {
  if(!(this instanceof DB)) { return new DB(srv || process.env.MONGO_URI, schemas, options) }

  //Connect to MongoDB.
  var conn = mongo.createConnection(srv, {useNewUrlParser: true, useUnifiedTopology: true}, function(err) {
    if(err) {
      console.error(err)
      if(typeof capture !== "undefined") { capture(err) }
    }
  })

  //Handle schemas.
  for(var key in schemas) {
    var schema = schemas[key]

    //Create model & fields from schema.
    var schemaOptions = {timestamps: {createdAt: "created", updatedAt: "updated"}}
    if(options && options.noTimestamps) { delete schemaOptions.timestamps }
    var model = conn.model(key, new mongo.Schema(schema, schemaOptions))
    var fields = getFields(schema).join(" ")

    //Create custom functions with our defaults & export.
    this.__proto__[key] = customFunctions(model, fields)
    this.__proto__[key].fields = fields
  }

  //Export mongo & connection.
  this.__proto__.connection = conn, this.__proto__.mongo = mongo
}



/*
Gets the fields to request from a schema.
*/
function getFields(schema, skip) {
  var result = []
  if(!skip) { result.push("-_id", "created", "updated") }

  for(var key in schema) {
    var val = schema[key], type = String(val.constructor && val.constructor.name).toLowerCase()

    if(type == "array") {
      var sub = getFields(val[0], true)
      
      for(var i in sub) { result.push(key + "." + sub[i]) }
      continue
    }
    if(type == "object") {
      if(val.type) { val = val.type, type = String(val.constructor && val.constructor.name).toLowerCase() }
      if(type == "object") {
        var sub = getFields(val, true)
        for(var i in sub) { result.push(key + "." + sub[i]) }
        continue
      }
    }

    result.push(key)
  }

  return result
}



/*
Creates customized functions for Mongoose with prefilled fields & custom sorting.
*/
function customFunctions(model, fields) {
  var override = [
    "find", "findOne", "findById",
    "update", "updateOne", "updateMany", "findOneAndUpdate", "findByIdAndUpdate",
    "replaceOne", "findOneAndReplace",
    "remove", "deleteOne", "deleteMany", "findOneAndRemove", "findOneAndDelete", "findByIdAndRemove", "findByIdAndDelete"
  ]

  //Create override functions that change defaults.
  for(var i in override) {
    var name = override[i]

    //Permanently transfer function name using scoped function.
    var newFn = function(fnName) {
      var fn = model.__proto__[fnName].bind(model)

      return function() {
        var result = fn(...arguments)
        result.__proto__.ogThen = result.then

        result.then = function(callback) {
          if(typeof result._mongooseOptions.lean == "undefined") { result.lean(true) }
          if(!result._userProvidedFields) { result.select(fields)  }
          if(!result.options.sort) { result.sort(defaultSort) }

          result.ogThen(callback)
        }

        return result
      }
    }(name)

    model[name] = newFn
  }

  return model
}
