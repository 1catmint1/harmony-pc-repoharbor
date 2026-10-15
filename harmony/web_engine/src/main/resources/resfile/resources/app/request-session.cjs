'use strict';
// SPDX-License-Identifier: MIT
class RequestSession {
  constructor(){this.generation=0;this.tickets=new Map();}
  reset(){this.generation++;this.tickets.clear();}
  capture(kind,owner,path){const ticket={generation:this.generation,owner,path};this.tickets.set(kind,ticket);return ticket;}
  valid(kind,ticket,owner,path){return this.generation===ticket.generation&&this.tickets.get(kind)===ticket&&ticket.owner===owner&&ticket.path===path;}
}
module.exports={RequestSession};
