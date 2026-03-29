from flask import Flask, jsonify, render_template, request, session, redirect
import json
import os

app = Flask(__name__)
app.secret_key = "secret123"

# ── Load Data ─────────────────────────────────────────────────────────────────
DATA_PATH = os.path.join(os.path.dirname(__file__), "data.json")

def load_data():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/get_centuries")
def get_centuries():
    """Return all available centuries in sorted order."""
    data = load_data()
    order = ["1st", "5th", "10th", "12th", "16th", "17th", "18th",
             "19th", "20th", "21st"]
    centuries = [c for c in order if c in data]
    return jsonify({"centuries": centuries})


@app.route("/get_countries/<century>")
def get_countries(century):
    """Return countries available for a given century."""
    data = load_data()
    if century not in data:
        return jsonify({"error": f"No data found for the {century} century."}), 404
    countries = sorted(data[century].keys())
    return jsonify({"countries": countries})


@app.route("/get_kings/<century>/<country>")
def get_kings(century, country):
    """Return top-10 king names for a given century and country."""
    data = load_data()
    if century not in data:
        return jsonify({"error": f"No data found for the {century} century."}), 404
    if country not in data[century]:
        return jsonify({"error": f"No data found for {country} in the {century} century."}), 404
    kings = [
        {"index": i, "name": k["name"], "reign": k["reign"], "type": k.get("type", "")}
        for i, k in enumerate(data[century][country][:10])
    ]
    return jsonify({"kings": kings})


@app.route("/get_king_info/<century>/<country>/<int:king_index>")
def get_king_info(century, country, king_index):
    """Return full details for a specific king."""
    data = load_data()
    try:
        king = data[century][country][king_index]
        return jsonify({"king": king})
    except (KeyError, IndexError):
        return jsonify({"error": "King not found."}), 404


@app.route("/search")
def search():
    """Search kings by name across all centuries and countries."""
    query = request.args.get("q", "").lower().strip()
    if not query or len(query) < 2:
        return jsonify({"error": "Search query must be at least 2 characters."}), 400

    data = load_data()
    results = []
    for century, countries in data.items():
        for country, kings in countries.items():
            for i, king in enumerate(kings):
                if query in king["name"].lower():
                    results.append({
                        "name": king["name"],
                        "century": century,
                        "country": country,
                        "king_index": i,
                        "reign": king["reign"],
                        "type": king.get("type", "")
                    })

    return jsonify({"results": results, "query": query})


@app.route("/get_all_types")
def get_all_types():
    """Return all unique king types for filtering."""
    data = load_data()
    types = set()
    for countries in data.values():
        for kings in countries.values():
            for king in kings:
                if king.get("type"):
                    types.add(king["type"])
    return jsonify({"types": sorted(list(types))})

# 🔥 YAHAN SE START
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")

        if username == "admin" and password == "1234":
            session["logged_in"] = True
            return redirect("/admin")
        else:
            return "Wrong credentials"

    return render_template("login.html")


@app.route("/admin")
def admin():
    if not session.get("logged_in"):
        return redirect("/login")
    return render_template("admin.html")


# 🔥 YAHAN PASTE KAR
@app.route("/add_king", methods=["POST"])
def add_king():
    if not session.get("logged_in"):
        return redirect("/login")

    data = load_data()

    century = request.form.get("century")
    country = request.form.get("country")
    name = request.form.get("name")
    reign = request.form.get("reign")
    type_ = request.form.get("type")
    bio = request.form.get("bio")

    new_king = {
        "name": name,
        "reign": reign,
        "type": type_,
        "bio": bio,
        "achievements": []
    }

    if century not in data:
        data[century] = {}

    if country not in data[century]:
        data[century][country] = []

    data[century][country].append(new_king)

    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return "King added successfully ✅ <br><a href='/admin'>Go Back</a>"


@app.route("/delete_king", methods=["POST"])
def delete_king():
    if not session.get("logged_in"):
        return redirect("/login")

    data = load_data()

    century = request.form.get("century").strip()
    country = request.form.get("country").strip()
    name = request.form.get("name").strip().lower()

    # 🔍 DEBUG PRINT (important)
    print("INPUT:", century, "|", country, "|", name)

    # 🔥 flexible match (case-insensitive)
    for c in data:
        if c.strip().lower() == century.lower():

            for ctr in data[c]:
                if ctr.strip().lower() == country.lower():

                    original_len = len(data[c][ctr])

                    data[c][ctr] = [
                        k for k in data[c][ctr]
                        if k["name"].strip().lower() != name
                    ]

                    if len(data[c][ctr]) < original_len:
                        with open(DATA_PATH, "w", encoding="utf-8") as f:
                            json.dump(data, f, indent=2)

                        return "King deleted successfully ✅ <br><a href='/admin'>Go Back</a>"
                    else:
                        return "King not found ❌"

    return "Invalid century/country ❌"

@app.route("/edit_king", methods=["POST"])
def edit_king():
    if not session.get("logged_in"):
        return redirect("/login")

    data = load_data()

    century = request.form.get("century")
    country = request.form.get("country")
    index = int(request.form.get("index"))

    name = request.form.get("name")
    reign = request.form.get("reign")
    bio = request.form.get("bio")

    try:
        data[century][country][index]["name"] = name
        data[century][country][index]["reign"] = reign
        data[century][country][index]["bio"] = bio
    except:
        return "Error editing"

    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return "Updated ✅ <br><a href='/admin'>Go Back</a>"

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/login")

# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=5000)
