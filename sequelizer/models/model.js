const { DataTypes, Deferrable, DATE } = require('sequelize');
const { sequelize } = require('../../config/config');

const resorts = sequelize.define('resorts', {
  resortRefNum: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false,
    primaryKey: true
  },
  resortID: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  resortName: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  listingID: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  listingName: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  unitType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
});
  
const execution = sequelize.define('execution', {
  // Model attributes are defined here
  execID: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false,
    primaryKey: true
  },

  resortRefNum: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: resorts,
        key: 'resortRefNum',
        deferrable: Deferrable.INITIALLY_IMMEDIATE
      }
  },

  execType: {
    type: DataTypes.STRING,
    allowNull: false
  },

  execStatus: {
    type: DataTypes.STRING,
    allowNull: false
  },

  monthstoScrape: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  datetoUpdate: {
    type: DataTypes.DATE,
    allowNull: true
  }

}, {
  // Other model options go here
  timestamps: true,
});


// Define the association between User and Post
resorts.hasMany(execution, { foreignKey: 'resortRefNum' });
execution.belongsTo(resorts, { foreignKey: 'resortRefNum' });

(async () => {
   await sequelize.sync({ alter: true });
   // Code here
 })();


module.exports = {
    resorts,
    execution
}