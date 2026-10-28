import "dotenv/config";
import { app } from "./app";
import { demarrerTachesDeNuit } from "./taches-arriere-plan/nuit";

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log("Serveur demarre sur http://localhost:" + port);

  // Jour 7 : recalcul des agregats et purge des empreintes, chaque nuit a 02h00 UTC.
  demarrerTachesDeNuit();
});