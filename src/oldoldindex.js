require("dotenv").config();
const express = require("express");
const { Sequelize, DataTypes } = require("sequelize");
const app = express();
app.use(express.json());

// Initialize Sequelize with SQLite database
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./Database/app.sqlite",
});

// Define the models
const Customer = sequelize.define('Customer', {
  Customer_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Customer_Name: DataTypes.STRING,
  Customer_address: DataTypes.STRING,
  Customer_Phonenumber: DataTypes.STRING,
});

const Product = sequelize.define('Product', {
  Product_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Product_Name: DataTypes.STRING,
  Product_Price: DataTypes.INTEGER,
  Product_Description: DataTypes.STRING,
  Product_image: DataTypes.STRING,
});

const Employees = sequelize.define('Employees', {
  Employees_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Employees_Name: DataTypes.STRING,
  Employees_Position: DataTypes.STRING,
  Employees_Phonenumber: DataTypes.STRING,
});

const Order = sequelize.define('Order', {
  Order_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Order_Datetime: DataTypes.DATE,
  Order_Customer_ID: {
    type: DataTypes.INTEGER,
    references: {
      model: Customer,
      key: 'Customer_ID',
    }
  },
  Order_Product_ID: {
    type: DataTypes.INTEGER,
    references: {
      model: Product,
      key: 'Product_ID',
    }
  },
  Order_Price_Unit: DataTypes.INTEGER,
  Order_Total_Price: DataTypes.INTEGER,
});

const Promotion = sequelize.define('Promotion', {
  Promotion_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Promotion_Name: DataTypes.STRING,
  Promotion_Discount: DataTypes.INTEGER,
  Promotion_Start_Date: DataTypes.DATE,
  Promotion_end_Date: DataTypes.DATE,
  Promotion_Description: DataTypes.STRING,
});

const Payment = sequelize.define('Payment', {
  Payment_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Payment_Type: DataTypes.STRING,
  Payment_Amount: DataTypes.INTEGER,
  Payment_Date: DataTypes.DATE,
  Payment_Promotion_ID: {
    type: DataTypes.INTEGER,
    references: {
      model: Promotion,
      key: 'Promotion_ID',
    }
  },
  Payment_Status: DataTypes.STRING,
  Payment_Order_ID: {
    type: DataTypes.INTEGER,
    references: {
      model: Order,
      key: 'Order_ID',
    }
  }
});

const Delivery = sequelize.define('Delivery', {
  Delivery_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Delivery_Status: DataTypes.STRING,
  Delivery_date: DataTypes.DATE,
  Delivery_Order_ID: {
    type: DataTypes.INTEGER,
    references: {
      model: Order,
      key: 'Order_ID',
    }
  },
  Delivery_Employees_ID: {
    type: DataTypes.INTEGER,
    references: {
      model: Employees,
      key: 'Employees_ID',
    }
  }
});

const Material = sequelize.define('Material', {
  Material_ID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  Material_Name: DataTypes.STRING,
  Material_Quantity: DataTypes.INTEGER,
  Material_Unit: DataTypes.STRING,
  Date_Update: DataTypes.DATE,
});

// Many-to-many relationship using a junction table
const MaterialProduct = sequelize.define('MaterialProduct', {
  Material_ID: {
    type: DataTypes.INTEGER,
    references: {
      model: Material,
      key: 'Material_ID',
    },
    primaryKey: true,
  },
  Product_ID: {
    type: DataTypes.INTEGER,
    references: {
      model: Product,
      key: 'Product_ID',
    },
    primaryKey: true,
  },
});

// Many-to-Many Relationships
Material.belongsToMany(Product, { through: MaterialProduct, foreignKey: 'Material_ID' });
Product.belongsToMany(Material, { through: MaterialProduct, foreignKey: 'Product_ID' });

Order.belongsTo(Customer, { foreignKey: 'Order_Customer_ID' });
Order.belongsTo(Product, { foreignKey: 'Order_Product_ID' });
Payment.belongsTo(Order, { foreignKey: 'Payment_Order_ID' });
Payment.belongsTo(Promotion, { foreignKey: 'Payment_Promotion_ID' });
Delivery.belongsTo(Order, { foreignKey: 'Delivery_Order_ID' });
Delivery.belongsTo(Employees, { foreignKey: 'Delivery_Employees_ID' });

// Sync all models
sequelize.sync();

// API routes
const models = { Customer, Product, Employees, Order, Material, Promotion, Payment, Delivery };

Object.keys(models).forEach(modelName => {
  app.get(`/${modelName.toLowerCase()}s`, async (req, res) => {
    const records = await models[modelName].findAll();
    res.json(records);
  });

  app.get(`/${modelName.toLowerCase()}s/:id`, async (req, res) => {
    const record = await models[modelName].findByPk(req.params.id);
    record ? res.json(record) : res.status(404).send("Not found");
  });

  app.post(`/${modelName.toLowerCase()}s`, async (req, res) => {
    const record = await models[modelName].create(req.body);
    res.json(record);
  });

  app.put(`/${modelName.toLowerCase()}s/:id`, async (req, res) => {
    const record = await models[modelName].findByPk(req.params.id);
    if (!record) return res.status(404).send("Not found");
    await record.update(req.body);
    res.json(record);
  });

  app.delete(`/${modelName.toLowerCase()}s/:id`, async (req, res) => {
    const record = await models[modelName].findByPk(req.params.id);
    if (!record) return res.status(404).send("Not found");
    await record.destroy();
    res.send({ message: "Deleted" });
  });
});

// Starting the server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port http://localhost:${port}`));
