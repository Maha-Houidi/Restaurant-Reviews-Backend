import { ObjectId } from "mongodb"
import mongodb from "mongodb"
// const ObjectId = mongodb.ObjectId

let restaurants // variable where to store a reference to our collection

export default class RestaurantsDAO {
    //we will use this function  when the server starts to connect and get a reference to our restaurant collection
    static async injectDB(conn) {
        if(restaurants){
            return
        }
        try{
            restaurants = await conn.db(process.env.RESTREVIEWS_NS).collection("restaurants")
        } catch (e){
            console.error(
                `Unable to establish a collection handle in restaurantsDAO: ${e}`,
            )
        }
    }

    static async getRestaurants({
        filters = null,
        page = 0, 
        restaurantsPerPage = 20,
    } = {}) {
        let query 
        //we can search by name , cuisine, or zipcode of the restaurants it depends on filters 
        if (filters) {
            if("name" in filters){
                query = {$text: {$search: filters["name"]}}
                //we search instead of sth equal, for any text , anywhere in that text for that name passed in filters
            } else if ("cuisine" in filters){
                query = {"cuisine": {$eq: filters["cuisine"]}}
                //if the cuisine in the db equals the cuisine passed in the filters 
            }else if ("zipcode" in filters){
                query = {"address.zipcode": {$eq: filters["zipcode"]}}
            }
        }

        let cursor

        try{
            cursor = await restaurants 
            .find(query) //this will find from the db all the restaurants that match the query passed in 
            //if the query is blank it will return all the restaurants 
        }catch(e) {
            console.error(`Unable to issue find command , ${e}`)
            return { restaurantsList : [], totalNumRestaurants: 0 }
        }

        //if there is no error, we're going to limit the results to 20 per page 
        // skip => to get the actual page number
        const displayCursor = cursor.limit(restaurantsPerPage).skip(restaurantsPerPage * page)

        try{
            const restaurantsList = await displayCursor.toArray()
            const totalNumRestaurants = await restaurants.countDocuments(query) 

            return { restaurantsList , totalNumRestaurants }
        } catch(e){
            console.error(`Unable to convert cursor to array or problem counting documents , ${e}`)
            return { restaurantsList : [], totalNumRestaurants: 0 }
        }
    }


    static async getRestaurantByID(id) {
        try{
            const pipeline = [
                {
                    $match:{
                        _id : new ObjectId(id),
                    },
                },
                    {
                        $lookup: {
                            from: "reviews",
                            let: {
                                id: "$_id",
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $eq: ["$restaurant_id", "$$id"],
                                        },
                                    },
                                },
                                {
                                    $sort: {
                                        date: -1,
                                    },
                                },
                            ],
                            as: "reviews",
                        },
                    },
                    {
                        $addFields: {
                            reviews: "$reviews",
                        },
                    },
            ]
        return await restaurants.aggregate(pipeline).next()
        }catch(e){
            console.error(`Something went wrong in getRestaurantById: ${e}`)
            throw e
        }
    }

    static async getCuisines(){
        let cuisines = []
        try{
            cuisines  = await restaurants.distinct("cuisine")
            return cuisines
        }catch(e){
            console.error(`Unable to get cuisines, ${e}`)
            return cuisines
        }
    }
}



