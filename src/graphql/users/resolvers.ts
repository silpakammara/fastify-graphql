
import { UserProfileServiceSimple } from "../../services/userProfileServiceSimple"



export const userResolvers=(db:any)=>{
     const userService=new UserProfileServiceSimple(db)

     return{
        Query:{
            user:async(_:any, {id}:{id:string})=>{
                return userService.findById(id)
            },
            users:async(_:any, {filters}:any)=>{
                return userService.list(filters||{})
            },
        },
        Mutation:{
            createUser:async(_:any,{data}:any)=>{
                return userService.create(data);
            },
            updateUser:async(_:any, {id, data}:any)=>{
                return userService.update(id, data);
            },
            deleteUser:async(_:any, {id}:any)=>{
                return userService.delete(id);
            }
        }
    }
}