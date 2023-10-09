const { DataTypes, Deferrable } = require('sequelize');
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
      allowNull: false
    }
  
  }, {
    // Other model options go here
    timestamps: true
  });

  


// Define the association between User and Post
resorts.hasMany(execution, { foreignKey: 'resortRefNum' });
execution.belongsTo(resorts, { foreignKey: 'resortRefNum' });

(async () => {
    await sequelize.sync({alter:true});
    // Code here
  })();
// use sequelize.close() if all database actions are done

//////////////////////////////////////////////////////////////////////////////////////////////////

// class User extends Model {
//     static classLevelMethod() {
//       return 'foo';
//     }
//     instanceLevelMethod() {
//       return 'bar';
//     }
//     getFullname() {
//       return [this.firstname, this.lastname].join(' ');
//     }
//   }
//   User.init({
//     firstname: Sequelize.TEXT,
//     lastname: Sequelize.TEXT
//   }, { sequelize });
  
//   console.log(User.classLevelMethod()); // 'foo'
//   const user = User.build({ firstname: 'Jane', lastname: 'Doe' });
//   console.log(user.instanceLevelMethod()); // 'bar'
//   console.log(user.getFullname()); // 'Jane Doe'

module.exports = {
    resorts,
    execution
}