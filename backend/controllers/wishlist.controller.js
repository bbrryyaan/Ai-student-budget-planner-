import Wishlist from "../models/wishlist.js";

export const listWishlist = async (req, res) => {
  try {
    const mode = req.query.mode === "demo" ? "demo" : "actual";
    const items = await Wishlist.find({ 
      userId: req.user.id,
      entryMode: mode
    }).sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: "Failed to load wishlist" });
  }
};

export const addToWishlist = async (req, res) => {
  try {
    const { itemName, amount, priority, note, entryMode } = req.body;
    const item = await Wishlist.create({
      userId: req.user.id,
      itemName,
      amount,
      priority: priority || "medium",
      note,
      entryMode: entryMode === "demo" ? "demo" : "actual",
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: "Failed to add to wishlist" });
  }
};

export const removeFromWishlist = async (req, res) => {
  try {
    await Wishlist.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.status(200).json({ message: "Removed from wishlist" });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove item" });
  }
};

export const markAsBought = async (req, res) => {
  try {
    const item = await Wishlist.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { status: "bought" },
      { new: true }
    );
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: "Failed to update item" });
  }
};
