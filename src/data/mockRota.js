export const mockStaff = [
  { id: 's1', name: 'Claire Hadley',  role: 'manager', roleCode: 'MGR', gender: 'F', driver: true,  home: 'meadowview' },
  { id: 's2', name: 'James Osei',     role: 'deputy',  roleCode: 'DM',  gender: 'M', driver: true,  home: 'meadowview' },
  { id: 's3', name: 'Priya Nair',     role: 'senior',  roleCode: 'SC',  gender: 'F', driver: true,  home: 'meadowview' },
  { id: 's4', name: 'Dayo Adeyemi',   role: 'rcw',     roleCode: 'RCW', gender: 'M', driver: false, home: 'meadowview' },
  { id: 's5', name: 'Sophie Wright',  role: 'rcw',     roleCode: 'RCW', gender: 'F', driver: false, home: 'meadowview' },
  { id: 's6', name: 'Marco Testa',    role: 'rcw',     roleCode: 'RCW', gender: 'M', driver: true,  home: 'meadowview' },
  { id: 's7', name: 'Amara Diallo',   role: 'rcw',     roleCode: 'RCW', gender: 'F', driver: false, home: 'meadowview' },
  { id: 's8', name: 'Tyler Beckett',  role: 'relief',  roleCode: 'REL', gender: 'M', driver: true,  home: null },
  { id: 's9', name: 'Kezia Okonkwo',  role: 'relief',  roleCode: 'REL', gender: 'F', driver: false, home: null },
]

export const mockRota = {
  early: [
    [ {id:'s3',sleepIn:false}, {id:'s4',sleepIn:false}, {id:'s5',sleepIn:false} ],
    [ {id:'s2',sleepIn:false}, {id:'s6',sleepIn:false}, {id:'s7',sleepIn:false} ],
    [ {id:'s3',sleepIn:false}, {id:'s4',sleepIn:false}, {id:'s8',sleepIn:false} ],
    [ {id:'s2',sleepIn:false}, {id:'s5',sleepIn:false}, {id:'s9',sleepIn:false} ],
    [ {id:'s3',sleepIn:false}, {id:'s6',sleepIn:false}, {id:'s7',sleepIn:false} ],
    [ {id:'s4',sleepIn:false}, {id:'s5',sleepIn:false}, {id:'s8',sleepIn:false} ],
    [ {id:'s2',sleepIn:false}, {id:'s9',sleepIn:false} ],
  ],
  late: [
    [ {id:'s1',sleepIn:false}, {id:'s6',sleepIn:true},  {id:'s7',sleepIn:true}  ],
    [ {id:'s3',sleepIn:true},  {id:'s8',sleepIn:false}, {id:'s4',sleepIn:true}  ],
    [ {id:'s2',sleepIn:true},  {id:'s5',sleepIn:true},  {id:'s9',sleepIn:false} ],
    [ {id:'s1',sleepIn:false}, {id:'s7',sleepIn:true},  {id:'s3',sleepIn:true}  ],
    [ {id:'s2',sleepIn:true},  {id:'s4',sleepIn:true},  {id:'s8',sleepIn:false} ],
    [ {id:'s3',sleepIn:true},  {id:'s6',sleepIn:true},  {id:'s9',sleepIn:false} ],
    [ {id:'s1',sleepIn:false}, {id:'s5',sleepIn:true},  {id:'s7',sleepIn:true}  ],
  ],
  onCall: [
    ['s1','s2'], ['s1','s3'], ['s2','s3'],
    ['s1','s2'], ['s2','s3'], ['s1','s3'],
    ['s1','s2'],
  ]
}