const { Sequelize, DataTypes, Deferrable } = require('sequelize');
const { database, dbUsername, dbPassword } = require('../../config/config');

const sequelize = new Sequelize(database, dbUsername, dbPassword, {
    host: 'localhost',
    dialect: 'mysql',
    define : { freezeTableName: true }
});

const resorts = sequelize.define('resorts', {
    resortID: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
    },
    resortName: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    listingID: {
        type: DataTypes.STRING,
        allowNull: false
    },
    listingName: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    unitType: {
        type: DataTypes.STRING,
        allowNull: false
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
});


const execution = sequelize.define('execution', {
    // Model attributes are defined here
    execID: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true
    },

    execType: {
        type: DataTypes.STRING,
        allowNull: false
    },

    // resortID: {
    //     type: DataTypes.STRING,    
    //     allowNull: false,
    //     references: {
    //         model: resorts,
    //         key: 'resortID',
    //         deferrable: Deferrable.INITIALLY_IMMEDIATE
    //     }
    // },

    resortID: {
        type: DataTypes.STRING,
        allowNull: false
    },

    execStatus: {                   
        type: DataTypes.STRING,
        allowNull: false
    }

}, {
    // Other model options go here
    timestamps: true,
});


(async () => {
    await sequelize.sync();
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