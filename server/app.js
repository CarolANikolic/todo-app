import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import bodyParser from "body-parser";
import { v4 as uniqueID } from 'uuid';
import db from "./database/databaseConfig.js";
import insertDataIntoDb from "./service/insertDataIntoDb.js";
import { handleExit } from "./service/handleExitSignals.js";
import isEmptyInput from "./utils/isEmptyInput.js";
import checkIsInputRepeated from "./service/checkIsInputRepeated.js";
import queryAllItems from "./service/queryAllItems.js";
import updateEditedItem from "./service/updateEditedItem.js";
import http from "http";

const app = express();
const port = 3000;

db.connect()

// Define paths: current file, client directory, current  directory, json file.
const __fileName = fileURLToPath(import.meta.url);
const __clientDir = path.resolve(__fileName, "../../client");

// Serve static files from the client side
app.use(express.static(__clientDir));

// Set the view engine to ejs
app.set("view engine", "ejs");

// Set the views folder where the ejs files are located
app.set("views", path.join(__clientDir, "views"));

// Parse json data
app.use(express.json())

// Mount middlware to pass body data encoded on the url
app.use(bodyParser.urlencoded({ extended: true }));

const items = await queryAllItems(db, "todo_list");

app.get("/", async (req, res) => {
    res.render("index.ejs", { items: items, errorMessage: "" });
});

app.post("/", async (req, res) => {
    const content = req.body.item;

    if (!isEmptyInput(content)) {
        try {
            const newItem = {
                id: uniqueID(),
                content: content,
                active: true
            };

            const repeatedItems = await checkIsInputRepeated(db, newItem.content);

            if (repeatedItems.length === 0) {
                const tableName = "todo_list";
                const columns = ["id", "content", "active"];
                const values = [newItem.id, newItem.content, newItem.active];

                await insertDataIntoDb(db, tableName, columns, values);

                const updatedItems = await queryAllItems(db, "todo_list");
                res.render("index.ejs", { items: updatedItems, errorMessage: "" });
            } else {
                res.render("index.ejs", { items: items, errorMessage: "This item already exists." });
            }

        } catch (err) {
            console.error('Error inserting item into database:', err);
            res.status(500).send('Error adding item.');
        }
    }
});

app.put("/updateItem/:itemID", async (req, res) => {
    const itemID = req.params.itemID;
    const itemNewContent = req.body.content;

    try {
        const isNewContentRepeated = await checkIsInputRepeated(db, itemNewContent);

        if (isNewContentRepeated.length === 0) {
            const editedItemResult = await updateEditedItem(db, itemID, itemNewContent);

            if (editedItemResult !== 0 && isEmptyInput(itemNewContent) === false) {
                res.json({ errorMessage: "" });
                console.log("Item updated successfully.")
            } else {
                res.status(404).json({ errorMessage: "Item not found." });
            }
        } else {
            res.json({ errorMessage: "This item already exists." });
        }
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({ error: "Error updating item." });
    }
});

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}.`);
});

handleExit(db, server);