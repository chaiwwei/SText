//review 2024-7-26
class StringObject {
  iop; // store an insert operation timestamps <sid,seq>
  dops; //store a list of delete operation timestamps [<sid1,seq1>,<sid2,seq2>,...,<sidk,seqk>]
  str; // a string of characters
  next; // a reference to other aobjects

  constructor(op, str) {
    this.iop = op;
    this.dops = [];
    this.str = str;
    this.next = undefined;
  }

  compare(obj) {
    if (this.iop.sid == obj.iop.sid) {
      return this.iop.seq - obj.iop.seq;
    } else {
      return this.iop.sid - obj.iop.sid;
    }
  }

  attach(op) {
    this.dops.push(op);
  }

  split(num) {
    if (num == 0 || num == this.str.length) {
      return;
    }

    let obj = new StringObject(this.iop, this.str.substring(num));
    this.dops.forEach((dop) => {
      obj.attach(dop);
    });
    this.str = this.str.substring(0, num);
    obj.next = this.next;
    this.next = obj;
  }

  appeared(vc) {
    return this.iop == null || vc[this.iop.sid] >= this.iop.seq;
  }

  deleted(vc) {
    return this.dops.some((dop) => dop == null || vc[dop.sid] >= dop.seq);
  }

  inVisible() {
    return this.dops.length > 0;
  }

  visible(vc) {
    return this.appeared(vc) && !this.deleted(vc);
  }

  clean(vcMin) {
    if (this.iop != null && this.iop.seq <= vcMin[this.iop.sid]) {
      this.iop = null;
    }

    let deleted = false;
    for (let dop in this.dops) {
      if (dop == null || dop.seq <= vcMin[dop.sid]) {
        deleted = true;
        break;
      }
    }
    if (deleted) {
      this.dops = [null];
    }
  }
}

//review 2024-7-26
class STextInstance {
  head;
  tail;

  constructor(content) {
    this.head = {
      str: "head",
      next: undefined,
    };

    this.tail = {
      str: "tail",
      next: undefined,
    };

    if (content != undefined && content.length > 0) {
      let obj = new StringObject(null, content);
      obj.next = this.tail;
      this.head.next = obj;
    } else {
      this.head.next = this.tail;
    }
  }

  insert(pos, str, op) {
    let obj = new StringObject({ sid: op.sid, seq: op.vc[op.sid] }, str);
    let prev = this.findObjBeforePos(pos, op.vc);
    let next = this.findNextAppeared(prev, op.vc);
    this.insBetween(prev, next, obj);
    return obj;
  }

  delete(pos, len, op) {
    let prev = this.findObjAtPos(pos, op.vc);
    let tombsArr = this.findObjsFrom(prev, len, op.vc); //including prev;
    this.markDelete(tombsArr, { sid: op.sid, seq: op.vc[op.sid] });
    return tombsArr;
  }

  markDelete(SOlist, dop) {
    SOlist.forEach((obj) => {
      obj.attach(dop);
    });
  }

  findObjAtPos(pos, vc) {
    let cur = this.head.next;
    for (let num = 0; cur != this.tail; cur = cur.next) {
      if (cur.visible(vc)) {
        if (pos == num) {
          break;
        } else if (pos < num + cur.str.length) {
          cur.split(pos - num);
          pos = num;
        } else {
          num = num + cur.str.length;
        }
      }
    }
    return cur;
  }

  findObjBeforePos(pos, vc) {
    if (pos == 0) {
      return this.head;
    }

    let cur = this.head.next;
    for (let num = 0; cur != this.tail; cur = cur.next) {
      if (cur.visible(vc)) {
        if (pos < num + cur.str.length) {
          cur.split(pos - num);
          break;
        } else if (pos == num + cur.str.length) {
          break;
        } else {
          num = num + cur.str.length;
        }
      }
    }

    return cur;
  }

  findNextAppeared(prev, vc) {
    let cur = prev.next;
    for (; cur != this.tail; cur = cur.next) {
      if (cur.appeared(vc)) {
        break;
      }
    }
    return cur;
  }

  insBetween(lborder, rborder, obj) {
    let prev = lborder;
    for (let cur = lborder.next; cur != rborder; cur = cur.next) {
      if (cur.compare(cur) > 0) {
        prev = cur;
      }
    }
    obj.next = prev.next;
    prev.next = obj;
  }

  //traversal from start (including)
  findObjsFrom(start, len, vc) {
    let SOList = [];
    for (let cur = start, num = 0; cur != this.tail; cur = cur.next) {
      if (len == num) {
        break;
      } else if (cur.visible(vc)) {
        if (len < num + cur.str.length) {
          cur.split(len - num);
        }
        SOList.push(cur);
        num = num + cur.str.length;
      }
    }
    return SOList;
  }

  //from prev (not including) to obj (not inlcuding)
  indexOf(prev, obj) {
    let num = 0;

    for (let cur = prev.next; cur != obj; cur = cur.next) {
      if (!cur.inVisible()) {
        num = num + cur.str.length;
      }
    }

    return num;
  }

  createExterInsert(obj) {
    return [
      {
        type: "ins",
        pos: this.indexOf(this.head, obj),
        str: obj.str,
      },
    ];
  }

  createExterDelete(SOList) {
    let op = [];
    let prev = this.head;
    let num = 0;
    SOList.forEach((obj) => {
      num = num + this.indexOf(prev, obj);
      if (obj.dops.length == 1) {
        op.push({
          type: "del",
          pos: num,
          str: obj.str,
        });
      }
      prev = obj;
    });
    return op;
  }

  isGarbage(obj, vcMin) {
    return (
      obj.deleted(vcMin) && (obj.next == this.tail || obj.next.appeared(vcMin))
    );
  }

  clean(vcMin) {
    for (let cur = this.head.next; cur != this.tail; cur = cur.next) {
      cur.clean(vcMin);
    }

    let prev = this.head;
    for (let cur = this.head.next; cur != this.tail; cur = cur.next) {
      if (this.isGarbage(cur, vcMin)) {
        prev.next = cur.next;
        // prev and cur.next merge
      } else {
        prev = cur;
      }
    }

    prev = this.head;
    for (let cur = this.head.next; cur != this.tail; cur = cur.next) {
      if (this.mergable(prev, cur)) {
        prev.str = prev.str + cur.str;
        prev.next = cur.next;
      } else {
        prev = cur;
      }
    }
  }

  mergable(obj1, obj2) {
    if (obj1 == this.head || obj2 == this.tail) {
      return false;
    }

    let condition1 = obj1.iop == obj2.iop;
    let condition2 = obj1.dops.length == obj2.dops.length;
    let condition3 = obj1.dops.length == 0;
    let condition4 = obj1.dops[0] == null;
    let condition5 = obj2.dops[0] == null;

    return (
      condition1 && condition2 && (condition3 || (condition4 && condition5))
    );
  }

  getObjs() {
    let objs = [];

    for (let cur = this.head.next; cur != this.tail; cur = cur.next) {
      objs.push({
        str: cur.str,
        vis: cur.inVisible() == false,
      });
    }

    return objs;
  }
}

class CMSText {
  sid; //site id starts from 1,2,3,...,n;
  seq; // site sequence number
  snum; // total number of cooperating sites;
  mc; //matrix clock;
  olist; // list of operation ids, which are used to compute vector timestamps from scalar timestamps
  stext; //ObjectSequence

  constructor() {
    this.sid = undefined; //site no. starts from 1;
    this.seq = 0;
    this.snum = undefined;
    this.mc = undefined;
    this.olist = undefined;
    this.stext = undefined;
  }

  ini(sid, snum, content) {
    this.sid = sid;
    this.seq = 0;
    this.snum = snum;
    this.mc = new Array(snum + 1);
    for (let i = 1; i <= snum; i++) {
      this.mc[i] = new Array(snum + 1).fill(0);
    }
    this.olist = [null];
    this.stext = new STextInstance(content);
  }

  localHandle(eo) {
    this.localTPUpdate();

    let timestamp1 = {
      sid: this.sid,
      vc: this.mc[this.sid],
    };

    let timestamp2 = {
      id: { sid: this.sid, seq: this.seq },
      gn: undefined,
      gnr: this.computGNR(),
    };

    if (eo.type == "ins") {
      this.stext.insert(eo.pos, eo.str, timestamp1);
    } else {
      this.stext.delete(eo.pos, eo.str.length, timestamp1);
    }

    return {
      type: eo.type,
      pos: eo.pos,
      str: eo.str,
      timestamp: timestamp2,
    };
  }

  remoteHandle(io) {
    console.log("received op:");
    console.log(io);
    let eo = undefined;
    let timestamp = {
      sid: io.timestamp.id.sid,
      vc: this.computeVC(io.timestamp),
    };
    console.log("timestamp:");
    console.log(timestamp);
    if (io.type == "ins") {
      let obj = this.stext.insert(io.pos, io.str, timestamp);
      eo = this.stext.createExterInsert(obj);
    } else {
      let tombsArr = this.stext.delete(io.pos, io.str.length, timestamp);
      eo = this.stext.createExterDelete(tombsArr);
    }

    this.remoteTPUpdate(io.timestamp);

    console.log("transformed result:");
    console.log(eo);
    return eo;
  }

  timestamping(timestamp) {
    this.olist.splice(timestamp.gn, 0, timestamp.id);
  }

  localTPUpdate() {
    this.seq = this.seq + 1;
    this.mc[this.sid][this.sid] = this.seq;
  }

  remoteTPUpdate(timestamp) {
    let sid = timestamp.id.sid;
    this.mc[this.sid][sid] = this.mc[this.sid][sid] + 1;
    this.mc[sid] = this.computeVC(timestamp); //could get from the above step.
    this.olist.splice(timestamp.gn, 0, timestamp.id);
  }

  computGNR() {
    let gnr = 0;
    for (let i = this.olist.length - 1; i > 0; i--) {
      if (this.olist[i].sid != this.sid) {
        gnr = i; //here, we assume that gn is assign to 1,2,3,...,n
        break;
      }
    }
    return gnr;
  }

  computeVC(timestamp) {
    let vc = new Array(this.snum + 1).fill(0);
    vc[timestamp.id.sid] = timestamp.id.seq;

    for (let j = 1; j <= this.snum; j++) {
      if (j != timestamp.id.sid) {
        for (let i = timestamp.gnr; i > 0; i--) {
          let op = this.olist[i];
          if (op.sid == j) {
            vc[j] = op.seq;
            break;
          }
        }
      }
    }

    return vc;
  }

  minVC() {
    let min = new Array(this.snum + 1).fill(0);
    for (let i = 1; i <= this.snum; i++) {
      let inums = new Array(this.snum).fill(0);
      for (let j = 1; j <= this.snum; j++) {
        inums[j - 1] = this.mc[j][i];
      }
      min[i] = Math.min(...inums);
    }
    return min;
  }

  getState() {
    return {
      id: { sid: this.sid, seq: this.seq },
      gnr: this.computGNR(),
    };
  }

  updateState(timestamp) {
    //this.gnrArr[state.sid] = state.gnr;
    let sid = timestamp.id.sid;
    this.mc[sid] = this.computeVC(timestamp);
  }

  getObjs() {
    return this.stext.getObjs();
  }

  gc() {
    this.stext.clean(this.minVC());
  }
}
