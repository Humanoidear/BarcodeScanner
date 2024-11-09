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
    console.log(form);
    verifyCode(form.code)
        .then(isValid => {
            if (isValid) {
                db.none('INSERT INTO reparto (lectura, timestamp, almacen) VALUES ($1, $2, $3)', [form.barcode, form.timestamp, form.quantity])
                    .then(() => {
                        console.log('Data sent to the database');
                        res.redirect(redirectURL + '?message=Datos del formulario recibidos y almacenados en la base de datos');
                    })
                    .catch(error => {
                        console.error('Error sending data to the database', error);
                        res.redirect(redirectURL + '?message=Error al enviar datos a la base de datos');
                    });
            } else {
                res.redirect(redirectURL + '/login?message=Error: Código de verificación inválido o expirado');
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            res.redirect(redirectURL + '/login?message=Error al verificar el código de verificación');
        });
});

app.post('/afegir-centre', (req, res) => {
    const form = req.body;
    verifyCodeAdmin(form.code)
        .then(isValid => {
            if (isValid) {
                db.none('INSERT INTO centro (centro) VALUES ($1)', [form.name])
                    .then(() => {
                        console.log('Data sent to the database');
                        res.redirect(redirectURL + '/admin?message=Centro añadido con éxito');
                    })
                    .catch(error => {
                        console.error('Error sending data to the database', error);
                        res.redirect(redirectURL + '/admin?message=Error al añadir el centro');
                    });
            } else {
                res.redirect(redirectURL + '/admin?message=Error: Código de verificación inválido o expirado');
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            res.redirect(redirectURL + '/admin?message=Error al verificar el código de verificación');
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
    verifyCodeAdmin(form.code)
        .then(isValid => {
            if (isValid) {
                db.none('DELETE FROM centro WHERE id = $1', [form.delete])
                    .then(() => {
                        console.log('Data sent to the database');
                        res.redirect(redirectURL + '/admin?message=Centro eliminado con éxito');
                    })
                    .catch(error => {
                        console.error('Error sending data to the database', error);
                        res.redirect(redirectURL + '/admin?message=Error al eliminar el centro');
                    });
            } else {
                res.redirect(redirectURL + '/admin?message=Error: Código de verificación inválido o expirado');
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            res.redirect(redirectURL + '/admin?message=Error al verificar el código de verificación');
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
    verifyCodeAdmin(form.code)
        .then(isValid => {
            if (isValid) {
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
                                    res.redirect(redirectURL + '/admin?message=Artículo añadido con éxito');
                                })
                                .catch(error => {
                                    console.error('Error sending data to the database', error);
                                    res.redirect(redirectURL + '/admin?message=Error al añadir el artículo');
                                });
                        }
                    })
                    .catch(error => {
                        console.error('Error checking existing data in the database', error);
                        res.redirect(redirectURL + '/admin?message=Error al verificar el código de barras');
                    });
            } else {
                res.redirect(redirectURL + '/admin?message=Error: Código de verificación inválido o expirado');
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            res.redirect(redirectURL + '/?message=Error al verificar el código de verificación');
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
    console.log(form);
    verifyCode(form.code)
        .then(isValid => {
            if (isValid) {
                db.none('DELETE FROM reparto WHERE id = $1', [form.id])
                    .then(() => {
                        console.log('Data deleted from the database');
                        res.json({ message: 1 });
                    })
                    .catch(error => {
                        console.error('Error deleting data from the database', error);
                        res.redirect(redirectURL + '?message=Error al eliminar el palet');
                    });
            } else {
                res.json({ message: 0 });
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            res.redirect(redirectURL + '/?message=Error al verificar el código de verificación');
        });
});

app.post('/acceptar-palet', (req, res) => {
    const form = req.body;
    verifyCode(form.code)
        .then(isValid => {
            if (isValid) {
                db.none('UPDATE reparto SET fulfilled = 1, timestamp_recepcion = NOW() WHERE id = $1', [form.id])
                    .then(() => {
                        console.log('Data updated in the database');
                        res.json({ message: 1 });
                    })
                    .catch(error => {
                        console.error('Error updating data in the database', error);
                        res.status(500).json({ message: 'Error al aceptar el palet' });
                    });
            } else {
                res.json({ message: 0 });
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            res.redirect(redirectURL + '/?message=Error al verificar el código de verificación');
        });
});

app.post('/codi-expirat', (req, res) => {
    const form = req.body;
    // If the code is empty, return true
    if (!form.code) {
        console.log('Code not found');
        res.json({ expired: true });
        return;
    }
    // Ensure the code is an integer and within the valid range for a 32-bit integer
    const code = parseInt(form.code, 10);
    if (isNaN(code) || code < -2147483648 || code > 2147483647) {
        console.log('Code not found or out of range');
        res.json({ expired: true });
        return;
    }
    // Return the expiration date of the code, select from the first and only row
    db.oneOrNone('SELECT expiración FROM codigo WHERE codigo = $1', [code])
        .then(data => {
            // Check if it exists
            if (data) {
                // Check if the expiration date is in the past
                if (new Date(data.expiración) < new Date()) {
                    console.log('Code expired');
                    res.json({ expired: true });
                } else {
                    console.log('Code not expired');
                    res.json({ expired: false });
                }
            } else {
                console.log('Code not found');
                res.json({ expired: true });
            }
        })
        .catch(error => {
            console.error('Error receiving data from the database', error);
            res.status(500).json({ message: 'Error al recibir datos de la base de datos' });
        });
});

function verifyCode(code) {
    // Check if the code is null or not a number
    if (!code || isNaN(parseInt(code, 10))) {
        console.log('Code not found or invalid');
        return Promise.resolve(false);
    }

    // Fetch code and expiration date from the database
    return db.oneOrNone('SELECT codigo, expiración FROM codigo WHERE codigo = $1', [code])
        .then(data => {
            // If the code exists and is not expired, return true
            if (data && new Date(data.expiración) > new Date()) {
                console.log('Code verified');
                return true;
            } else {
                console.log('Code verification failed');
                return false;
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            return false;
        });
}

// ADMIN
app.post('/codi-expirat-admin', (req, res) => {
    const form = req.body;
    const code = form.code;
    if (!code) {
        console.log('Code not found');
        res.json({ expired: true });
        return;
    }

    // Return the expiration date of the code, select from the first and only row
    db.oneOrNone('SELECT expiración FROM codigoadmin WHERE codigo = $1', [code])
        .then(data => {
            // Check if it exists
            if (data) {
                // Check if the expiration date is in the past
                if (new Date(data.expiración) < new Date()) {
                    console.log('Code expired');
                    res.json({ expired: true });
                } else {
                    console.log('Code not expired');
                    res.json({ expired: false });
                }
            } else {
                console.log('Code not found');
                res.json({ expired: true });
            }
        })
        .catch(error => {
            console.error('Error receiving data from the database', error);
            res.status(500).json({ message: 'Error al recibir datos de la base de datos' });
        });
});

app.post('/canviar-mot-de-pas', (req, res) => {
    const form = req.body;
    verifyCodeAdmin(form.code)
        .then(isValid => {
            if (isValid) {
                // Set expiration to midnight if it is empty
                let expiration = form.expiration;
                if (!expiration || expiration == '') {
                    const today = new Date();
                    expiration = new Date(today.setHours(24, 0, 0, 0)).toISOString();
                }
                console.log(expiration);

                // Change the password in codigo table, set all to expired (Expiración is set to NOW()) and create a new code with the new password and a new expiration date
                db.tx(t => {
                    return t.batch([
                        t.none("UPDATE codigo SET expiración = NOW() WHERE expiración::timestamp > NOW()"),
                        t.none('INSERT INTO codigo (codigo, expiración) VALUES ($1, $2)', [form.password, expiration])
                    ]);
                })
                    .then(() => {
                        console.log('Password changed');
                        res.redirect(redirectURL + '/admin?message=Contraseña cambiada con éxito');
                    })
                    .catch(error => {
                        console.error('Error changing password:', error);
                        res.redirect(redirectURL + '/admin?message=Error al cambiar la contraseña');
                    });
            } else {
                res.redirect(redirectURL + '/admin?message=Error: Código de verificación inválido o expirado');
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            res.redirect(redirectURL + '/admin?message=Error al verificar el código de verificación');
        });
});

app.post('/codi-en-vigor', (req, res) => {
    const form = req.body;
    verifyCodeAdmin(form.code)
        .then(isValid => {
            if (isValid) {
                db.oneOrNone('SELECT codigo, expiración FROM codigo WHERE expiración::timestamp > NOW()')
                    .then(data => {
                        if (data) {
                            res.json({ data: { code: data.codigo, expiration: data.expiración } });
                        } else {
                            res.json({ message: 'No active code found' });
                        }
                    })
                    .catch(error => {
                        console.error('Error verifying code:', error);
                        res.status(500).json({ message: 'Error al verificar el código de verificación' });
                    });
            } else {
                res.redirect(redirectURL + '/admin?message=Error: Código de verificación inválido o expirado');
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            res.redirect(redirectURL + '/admin?message=Error al verificar el código de verificación');
        });
});

function verifyCodeAdmin(code) {
    if (!code) {
        console.log('Code not found');
        return false;
    }

    // Fetch code and expiration date from the database
    return db.oneOrNone('SELECT codigo, expiración FROM codigoadmin WHERE codigo = $1', [code])
        .then(data => {
            // If the code exists and is not expired, return true
            if (data && new Date(data.expiración) > new Date()) {
                console.log('Code verified');
                return true;
            } else {
                console.log('Code verification failed');
                return false;
            }
        })
        .catch(error => {
            console.error('Error verifying code:', error);
            return false;
        });
}



// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});