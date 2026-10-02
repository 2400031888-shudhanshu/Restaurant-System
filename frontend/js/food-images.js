(function () {
    const dishImages = {
        "paneer tikka": "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=900&q=85",
        "french fries": "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=85",
        "veg biryani": "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=900&q=85",
        "paneer butter masala": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=85",
        "margherita pizza": "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=85",
        "farmhouse pizza": "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?auto=format&fit=crop&w=900&q=85",
        "veg burger": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=85",
        "cheese burger": "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=85",
        "chocolate brownie": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=85",
        "ice cream": "https://images.unsplash.com/photo-1501446529957-6226bd447c46?auto=format&fit=crop&w=900&q=85",
        "cold coffee": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=85",
        "fresh lime soda": "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=900&q=85"
    };

    const categoryImages = {
        "Starters": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80",
        "Main Course": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=900&q=80",
        "Pizza": "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80",
        "Burgers": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
        "Desserts": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80",
        "Beverages": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=80"
    };

    window.setFoodImage = function (image, food) {
        const uploadedImage = String(food.image_url || "");
        const safeUploadedImage = /^(https?:\/\/|\/(?!\/)|[a-z0-9][^:]*$)/i.test(uploadedImage)
            ? uploadedImage
            : "";
        const foodName = String(food.food_name || "").trim().toLowerCase();
        const sources = [...new Set([
            safeUploadedImage,
            dishImages[foodName],
            categoryImages[food.category_name]
        ].filter(Boolean))];
        let nextSource = 0;

        image.addEventListener("error", () => {
            if (nextSource < sources.length) {
                image.src = sources[nextSource++];
            } else {
                image.remove();
            }
        });

        if (sources.length) {
            image.src = sources[nextSource++];
        } else {
            image.remove();
        }
    };
})();