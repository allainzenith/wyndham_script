////////////////////////////////////////////////////////////////////////////////
// CONTAINS THE CRUD OPERATIONS WITH THE AID OF METHODS PROVIDED BY SEQUELIZER
////////////////////////////////////////////////////////////////////////////////

//// USE THE SUBSCRIBE FUNCTION TOMORROW
const { execution, resorts } = require("../models/model");
const { sequelize } = require("../../config/config");
const { Op } = require("sequelize");

async function saveRecord(recordJson, objectType) {
  const typeofObject = objectType == "execution" ? execution : resorts;

  // create() function instantiates the object and saves it to the database
  try {
    const record = await typeofObject.create(recordJson);
    return record;
  } catch (error) {
    console.error("Error saving record: " + error);
    return null;
  }
}

async function countRecords(objectType, condJson) {
  try {
    const typeofObject = objectType == "execution" ? execution : resorts;
    const amount = await typeofObject.count({
      where: condJson,
    });

    return amount;
  } catch (error) {
    console.error("Error counting all records: " + error);
    return false;
  }
}

async function findAllRecords(objectType, order) {
  try {
    const typeofObject = objectType == "execution" ? execution : resorts;
    const records = await typeofObject.findAll({
      order: order,
    });

    return records;
  } catch (error) {
    console.error("Error fetching all records: " + error);
    return false;
  }
}

async function findLikeRecords(search, objectType, order, limit, offset) {
  try {
    const typeofObject = objectType == "execution" ? execution : resorts;
    var records = await typeofObject.findAll({
      where: {
        [Op.or]: [
          { resortID: { [Op.substring]: search } },
          { resortName: { [Op.substring]: search } },
          { listingName: { [Op.substring]: search } },
          { unitType: { [Op.substring]: search } },
        ],
      },
      order: order,
      limit: limit,
      offset: offset,
    });

    return records;
  } catch (error) {
    console.error("Error searching: " + error);
    return false;
  }
}

async function findRecords(condJson, objectType, order, limit, offset) {
  try {
    const typeofObject = objectType == "execution" ? execution : resorts;
    var records = await typeofObject.findAll({
      where: condJson,
      order: order,
      limit: limit,
      offset: offset,
    });

    return records;
  } catch (error) {
    console.error("Error finding records: " + error);
    return false;
  }
}

async function findByPk(primaryKey, objectType) {
  try {
    const typeofObject = objectType == "execution" ? execution : resorts;
    const record = await typeofObject.findByPk(primaryKey);
    return record;
  } catch (error) {
    console.error("Error finding record by primary key: " + error);
    return false;
  }
}

// For events and execution joined
async function joinTwoTables(fModel, sModel, condJson, order, limit, offset) {
  try {
    const firstModel = fModel == "execution" ? execution : resorts;
    const secondModel = sModel == "execution" ? execution : resorts;

    var records = await firstModel.findAll({
      where: condJson,
      include: [
        {
          model: secondModel,
          required: true,
        },
      ],
      order: order,
      limit: limit,
      offset: offset,
    });

    return records;
  } catch (error) {
    console.error("Error joining records: " + error);
    return false;
  }
}

async function buildInstance(objectType, jsonObject){

  const typeofObject = objectType == "execution" ? execution : resorts;
  try {
    const instance = typeofObject.build(jsonObject);
    return instance;
  } catch (error) {
    console.error("Error building instance: ", error.message);
    return null;
  }

}
async function updateRecord(recordJson, recordObject) {
  // update() function updates fields only specified and makes other fields as-is
  // save() saves the record to the database
  try {
    let newRecord = await recordObject.update(recordJson);
    await recordObject.save();
    console.log("Updated successfully!");
    console.log(JSON.stringify(newRecord, null, 4));
    return true;
  } catch (error) {
    console.error("Error updating record: " + error);
    return false;
  }
}

async function deleteRecord(recordObject) {
  // destroy() function instantiates the object and saves it to the database
  try {
    await recordObject.destroy();
    console.log("Deleted successfully!");
    return true;
  } catch (error) {
    console.error("Error deleting record: " + error);
    return false;
  }
}

module.exports = {
  saveRecord,
  findAllRecords,
  findRecords,
  findLikeRecords,
  findByPk,
  joinTwoTables,
  deleteRecord,
  updateRecord,
  countRecords,
  buildInstance
};
