const express = require('express');
const cors = require('cors');  
const bodyParser = require('body-parser');
const pgp = require('pg-promise')();

const db = pgp(process.env.DATABASE_URL || 'postgres://username:password@localhost:5432/reparto');
const redirectURL = process.env.REDIRECT_URL || 'http://localhost:4321';

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/upload', (req, res) => {
    const form = req.body;

    db.none('INSERT INTO reparto (lectura, timestamp, almacen) VALUES ($1, $2, $3)', [form.barcode, form.timestamp, form.quantity])
        .then(() => {
            console.log('Data sent to the database');
            res.redirect(redirectURL + '?message=Datos del formulario recibidos y almacenados en la base de datos');
        })
        .catch(error => {
            console.error('Error sending data to the database', error);
            res.redirect(redirectURL + '?message=Error al enviar datos a la base de datos');
        });
});

app.post('/afegir-centre', (req, res) => {
    const form = req.body;

    db.none('INSERT INTO centro (centro) VALUES ($1)', [form.name])
        .then(() => {
            console.log('Data sent to the database');
            res.redirect(redirectURL + '?message=Centro añadido con éxito');
        })
        .catch(error => {
            console.error('Error sending data to the database', error);
            res.redirect(redirectURL + '?message=Error al añadir el centro');
        });
});

app.get('/afegir-centre', (req, res) => {
    db.any('SELECT * FROM centro')
        .then(data => {
            console.log('Data received from the database');
            res.json(data);
        })
        .catch(error => {
            console.error('Error receiving data from the database', error);
            res.status(500).json({ message: 'Error al recibir datos de la base de datos' });
        });
});

app.post('/esborrar-centre', (req, res) => {
    const form = req.body;

    db.none('DELETE FROM centro WHERE id = $1', [form.delete])
        .then(() => {
            console.log('Data sent to the database');
            res.redirect(redirectURL + '?message=Centro eliminado con éxito');
        })
        .catch(error => {
            console.error('Error sending data to the database', error);
            res.redirect(redirectURL + '?message=Error al eliminar el centro');
        });
});

app.post('/verificar', (req, res) => {
    const form = req.body;

    db.any(`
        SELECT r.id, r.lectura, a.articulo AS lectura_nombre, c.centro AS almacen, r.timestamp, r.fulfilled, r.timestamp_recepcion
        FROM reparto r
        JOIN centro c ON r.almacen = c.id
        JOIN articulos a ON r.lectura = a.lectura
        WHERE r.lectura = $1
    `, [form.barcode])
        .then(data => {
            console.log('Data received from the database');
            res.json(data);
        })
        .catch(error => {
            console.error('Error receiving data from the database', error);
            res.status(500).json({ message: 'Error al recibir datos de la base de datos' });
        });
});

app.post('/afegir-article', (req, res) => {
    const form = req.body;

    // Check if the lectura value already exists
    db.oneOrNone('SELECT 1 FROM articulos WHERE lectura = $1', [form.barcode])
        .then(existing => {
            if (existing) {
                // If the lectura value already exists, redirect with an error message
                res.redirect(redirectURL + '?message=Error: El código de barras ya existe');
            } else {
                // If the lectura value does not exist, proceed with the insertion
                db.none('INSERT INTO articulos (lectura, articulo) VALUES ($1, $2)', [form.barcode, form.article])
                    .then(() => {
                        console.log('Data sent to the database');
                        res.redirect(redirectURL + '?message=Artículo añadido con éxito');
                    })
                    .catch(error => {
                        console.error('Error sending data to the database', error);
                        res.redirect(redirectURL + '?message=Error al añadir el artículo');
                    });
            }
        })
        .catch(error => {
            console.error('Error checking existing data in the database', error);
            res.redirect(redirectURL + '?message=Error al verificar el código de barras');
        });
});

app.post('/verificar-article', (req, res) => {
    const form = req.body;

    db.any('SELECT * FROM articulos WHERE lectura = $1', [form.barcode])
        .then(data => {
            console.log('Data received from the database');
            res.json(data);
        })
        .catch(error => {
            console.error('Error receiving data from the database', error);
            res.status(500).json({ message: 'Error al recibir datos de la base de datos' });
        });
});

app.get('/verificar-article', (req, res) => {
    db.any('SELECT * FROM articulos')
        .then(data => {
            console.log('Data received from the database');
            res.json(data);
        })
        .catch(error => {
            console.error('Error receiving data from the database', error);
            res.status(500).json({ message: 'Error al recibir datos de la base de datos' });
        });
});

app.post('/esborrar-palet', (req, res) => {
    const form = req.body;

    db.none('DELETE FROM reparto WHERE id = $1', [form.id])
        .then(() => {
            console.log('Data deleted from the database');
            res.json({ message: 'Palet eliminado con éxito' });
        })
        .catch(error => {
            console.error('Error deleting data from the database', error);
            res.status(500).json({ message: 'Error al eliminar el palet' });
        });
});

app.post('/acceptar-palet', (req, res) => {
    const form = req.body;

    db.none('UPDATE reparto SET fulfilled = 1, timestamp_recepcion = NOW() WHERE id = $1', [form.id])
        .then(() => {
            console.log('Data updated in the database');
            res.json({ message: 'Palet aceptado con éxito' });
        })
        .catch(error => {
            console.error('Error updating data in the database', error);
            res.status(500).json({ message: 'Error al aceptar el palet' });
        });
});


// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});